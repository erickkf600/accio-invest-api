import Movement from 'App/Models/Movement'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Asset from 'App/Models/Asset';
import { chain, flatMap, groupBy, map, round, sumBy } from 'lodash';
import Unfolding from 'App/Models/Unfolding';
import moment from 'moment'
import TickerRequests from 'App/services/ticker-requests.service';
import { DateTime } from 'luxon';

export default class InvestmentsMovementsController {
  private ticker = new TickerRequests()
  public async show(ctx: HttpContextContract) {
    const page: number = ctx.params.page;
    const limit: number = ctx.params.limit;
    let movements: any = await Movement.query()
    .select('id', 'cod', 'date_operation', 'qtd', 'type', 'type_operation', 'unity_value', 'obs', 'fee', 'total', 'unfold_id')
    .preload('typeOperation', (query) =>{
      query.select('title', 'full_title')
    })
    .preload('assetsType', (query) =>{
      query.select('title', 'full_title')
    })
    .preload('unfoldOperation', (query) => {
      query.select('id', 'from', 'to', 'factor')
    })
    .orderBy('year', 'desc')
    .orderBy('month_ref', 'desc')
    .paginate(page, limit)

    movements = movements.toJSON()

    let response = movements.data.map((el: any) => {
      const base: any =  {
        id: el.id,
        cod: el.cod,
        date_operation: el.date_operation,
        qtd: el.qtd,
        unity_value: +el.unity_value,
        obs: el.obs,
        fee: +el.fee,
        total: +el.total,
        type_operation: el.typeOperation,
        type: el.assetsType
      }
      if (el.unfoldOperation) {
        base.split_inplit = el.unfoldOperation;
      }

      return base

    })

    response = Object.assign({data:response} , {
      total: movements.meta.total,
      current_page: movements.meta.current_page,
      per_page: movements.meta.per_page
    })

    return response
  }
//DIARIO https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=01/01/2023&dataFinal=31/12/2023
  public async showByYear(ctx: HttpContextContract) {
    const year: number = ctx.params.year;
    const movements: any = await Movement.query()
    .select('id', 'cod', 'date_operation', 'qtd', 'type', 'type_operation', 'unity_value', 'obs', 'fee', 'total')
    .where('year', year)
    .preload('typeOperation', (query) =>{
      query.select('title', 'full_title')
    })
    .preload('assetsType', (query) =>{
      query.select('title', 'full_title')
    })

   const response = movements.map((el: any) => {
      return {
        id: el.id,
        cod: el.cod,
        date_operation: el.date_operation,
        qtd: el.qtd,
        unity_value: el.unity_value,
        obs: el.obs,
        fee: +el.fee,
        total: +el.total,
        type_operation: el.typeOperation,
        type: el.assetsType
      }
    })

    return response

  }

  public async showByYearPaginated(ctx: HttpContextContract) {
    const year: number = ctx.params.year;
    const page: number = ctx.params.page;
    const limit: number = ctx.params.limit;
    let movements: any = await Movement.query()
    .select('id', 'cod', 'date_operation', 'qtd', 'type', 'type_operation', 'unity_value', 'obs', 'fee', 'total')
    .where('year', 'LIKE', '%'+year+'%')
    .preload('typeOperation', (query) =>{
      query.select('title', 'full_title')
    })
    .preload('assetsType', (query) =>{
      query.select('title', 'full_title')
    })
    .paginate(page, limit)

    movements = movements.toJSON()

   let response = movements.data.map((el: any) => {
      return {
        id: el.id,
        cod: el.cod,
        date_operation: el.date_operation,
        qtd: el.qtd,
        unity_value: +el.unity_value,
        obs: el.obs,
        fee: +el.fee,
        total: +el.total,
        type_operation: el.typeOperation,
        type: el.assetsType
      }
    })

    response = Object.assign({data:response} , {
      total: movements.meta.total,
      current_page: movements.meta.current_page,
      per_page: movements.meta.per_page
    })

    return response

  }

  public async register(ctx: HttpContextContract) {
    const body: any = ctx.request.body()
    const items = Array.isArray(body) ? body : [body] // normaliza para array

    // TODO: capturar userid do token jwt
    const userId = 1

    const toCreate: any[] = []
    const toUpdate: any[] = []
    const movements: any[] = []
    const rentabilityPayload: any[] = []
    let isSell = false

    try {
      for (const iterator of items) {
        let unfolding: any = null
        if (iterator.type_operation === 1) { // Compra
          const hasAsset = await Asset.query()
            .where('cod', iterator.cod)
            .andWhere('user_id', userId)
            .first()

          if (!hasAsset) {
            toCreate.push({
              cod: iterator.cod,
              quantity: iterator.qtd,
              total: iterator.total,
              total_rendi: 0,
              type: iterator.type,
              total_fee: iterator.fee,
              user_id: userId,
            })
          } else {
            toUpdate.push({
              cod: iterator.cod,
              quantity: iterator.qtd,
              total: iterator.total,
              total_fee: iterator.fee,
              user_id: userId,
            })
          }
        } else if (iterator.type_operation === 2) { // Venda
          isSell = true
          toUpdate.push({
            cod: iterator.cod,
            quantity: -iterator.qtd,
            total: -iterator.total,
            total_fee: iterator.fee,
            user_id: userId,
          })
        } else if (iterator.type_operation === 3) { // Dividendos
          toUpdate.push({
            cod: iterator.cod,
            total_rendi: iterator.total,
            user_id: userId,
          })

          rentabilityPayload.push({
            dataInicio: moment(iterator.date_operation, "DD/MM/YYYY").format("YYYY-MM-DD"),
            dataFim: moment(iterator.date_operation, "DD/MM/YYYY").format("YYYY-MM-DD"),
            papeis_tipos: [{ papel: iterator.cod, tipo: iterator.type }]
          })
        } else if (iterator.type_operation === 4) { // Desdobramento / Grupamento
          unfolding = await Unfolding.create({
            cod: iterator.cod,
            date_operation: iterator.date_operation,
            from: iterator.from,
            to: iterator.to,
            factor: iterator.factor,
            obs: iterator.obs,
            user_id: userId,
            total: iterator.total || 0,
            year: +iterator.date_operation.split('/')[2],
          })

          const asset = await Asset.query()
            .where('cod', iterator.cod)
            .andWhere('user_id', userId)
            .first()

          if (asset) {
            let ratio = 1
            if ([1,2].includes(iterator.factor)) {
              ratio = Number(iterator.to) / Number(iterator.from)
            }

            if (ratio !== 1) {
              asset.quantity = Number(asset.quantity) * ratio
              asset.medium_price = asset.quantity > 0
              ? round((Number(asset.total) - Number(asset.total_fee)) / asset.quantity, 3) : 0
              await asset.save()
            }
          }
        }

        // Movements sempre
        movements.push({
          cod: iterator.cod,
          date_operation: iterator.date_operation,
          qtd: iterator.qtd,
          type: iterator.type,
          type_operation: iterator.type_operation,
          unity_value: iterator.unity_value,
          obs: iterator.obs,
          fee: iterator.fee,
          total: iterator.total,
          user_id: userId,
          month_ref: +iterator.date_operation.split('/')[1],
          year: +iterator.date_operation.split('/')[2],
          unfold_id: unfolding?.id,
        })
      }

      // === CREATE Assets ===
      const groupedCreate = groupBy(toCreate, "cod")
      const createData: any = map(groupedCreate, (items: any, cod) => {
        const quantity = sumBy(items, "quantity")
        const total = sumBy(items, "total")
        const total_fee = sumBy(items, "total_fee")
        return {
          cod,
          quantity,
          total,
          total_fee,
          total_rendi: 0,
          type: items[0].type,
          user_id: userId,
          medium_price: quantity > 0 ? round((total - total_fee) / quantity, 3) : 0,
        }
      })
      if (createData.length > 0) await Asset.createMany(createData)

      // === UPDATE Assets ===
      const groupedUpdate = groupBy(toUpdate, "cod")
      const updates = Object.entries(groupedUpdate).map(async ([cod, items]) => {
        const asset = await Asset.query()
          .where('cod', cod)
          .andWhere('user_id', userId)
          .firstOrFail()

        const qtdDelta = sumBy(items, (i: any) => i.quantity ?? 0)
        const totalDelta = sumBy(items, (i: any) => i.total ?? 0)
        const rendiDelta = sumBy(items, (i: any) => i.total_rendi ?? 0)
        const feeDelta = sumBy(items, (i: any) => i.total_fee ?? 0)

        asset.quantity = Number(asset.quantity ?? 0) + qtdDelta
        asset.total = Number(asset.total ?? 0) + totalDelta
        asset.total_rendi = Number(asset.total_rendi ?? 0) + rendiDelta
        asset.total_fee = Number(asset.total_fee ?? 0) + feeDelta

        if (qtdDelta > 0 || isSell) {
          if(asset.quantity <= 0) {
            asset.total_fee = 0
            asset.total = 0
          }
          asset.medium_price = asset.quantity > 0 ? round((asset.total - asset.total_fee) / asset.quantity, 3) : 0
          isSell = false
        }
        return asset.save()
      })
      await Promise.all(updates)

      // === CREATE Movements ===
      if (movements.length > 0) {
        let withRent = movements
        if(rentabilityPayload.length) {
          const payloadGrouped = chain(rentabilityPayload)
          .groupBy(item => `${item.dataInicio}_${item.dataFim}`)
          .map((grupo) => ({
              dataInicio: grupo[0].dataInicio,
              dataFim: grupo[0].dataFim,
              papeis_tipos: flatMap(grupo, 'papeis_tipos')
          }))
          .value();
          const resultados = await Promise.all(
            payloadGrouped.map(item => (
              this.ticker.accioTickerEarningsRequest(item).catch(e => {
                console.error(`Erro no item ${item.dataInicio}`, e);
                throw {
                  code: 4,
                  message:  `Ocorreu um erro ao buscar os dados de proventos`,
                };
              })
            ))
          )
          withRent = movements.map(movement => {
            const resultado = resultados.flat().find(r => r.ticker === movement.cod);
            if (resultado && resultado.proventos.length > 0) {
              return {
                ...movement,
                rentability: resultado.proventos[0].percent
              };
            }
            return movement;
          });
        }
        if(items[0].type_operation === 4) {
          const asset = await Asset.findBy("cod", withRent[0].cod)
          withRent[0].qtd = asset?.quantity
        }
        await Movement.createMany(withRent)
      }

    } catch (error) {
      console.error(error)
      throw { code: 4, message: `Ocorreu um erro ao cadastrar ${error}` }
    }

    return { success: true }
  }


  public async update(ctx: HttpContextContract) {
    const id: number = ctx.params.id;
    const body: any = ctx.request.body()[0];

    const movement: Movement = await Movement.findOrFail(id);
    const asset = await Asset.query()
    .where('cod', movement.cod)
    .andWhere('user_id', movement.user_id)
    .firstOrFail();

    // Converte campos string para número
    movement.qtd = parseFloat(movement.qtd as any) || 0;
    movement.total = parseFloat(movement.total as any) || 0;
    movement.fee = parseFloat(movement.fee as any) || 0;

    asset.quantity = parseFloat(asset.quantity as any) || 0;
    asset.total = parseFloat(asset.total as any) || 0;
    asset.total_fee = parseFloat(asset.total_fee as any) || 0;
    asset.total_rendi = parseFloat(asset.total_rendi as any) || 0;


    // Reverte movimento antigo no Asset
    if (movement.type_operation === 1) {
      asset.quantity -= movement.qtd;
      asset.total -= movement.total;
      asset.total_fee -= movement.fee;
    } else if (movement.type_operation === 2) {
      asset.quantity += movement.qtd;
      asset.total += movement.total;
      asset.total_fee -= movement.fee;
    } else if (movement.type_operation === 3) {
      asset.total_rendi -= movement.total;
    } else if (movement.type_operation === 4) {
      const unfolding = await Unfolding.query()
      .where('id', body.unfold_id)
      .andWhere('user_id', movement.user_id)
      .first();
      if (unfolding) {
        const ratio = Number(unfolding.to) / Number(unfolding.from);
        asset.quantity = Number(asset.quantity) / ratio;

        unfolding.merge({
          cod: body.cod ?? unfolding.cod,
          date_operation: body.date_operation ?? unfolding.date_operation,
          from: body.from ?? unfolding.from,
          to: body.to ?? unfolding.to,
          factor: body.factor ?? unfolding.factor,
          obs: body.obs ?? unfolding.obs,
          total: body.total ?? unfolding.total,
          year: +body.date_operation.split('/')[2] || unfolding.year,
        });

        await unfolding.save();
      }
    }




    // Atualiza movimento
    const [_, monthRef, year] = body.date_operation.split('/');
    movement.merge({
      cod: body.cod ?? movement.cod,
      date_operation: body.date_operation ?? movement.date_operation,
      qtd: body.qtd ?? movement.qtd,
      type: body.type ?? movement.type,
      type_operation: body.type_operation ?? movement.type_operation,
      unity_value: body.unity_value ?? movement.unity_value,
      obs: body.obs ?? movement.obs,
      fee: body.fee ?? movement.fee,
      total: body.total ?? movement.total,
      month_ref: +monthRef || movement.month_ref,
      year: +year || movement.year,
      updated_at: DateTime.fromJSDate(new Date()),
    });
    await movement.save();

    // Aplica movimento novo
    if (movement.type_operation === 1) {
      asset.quantity += movement.qtd;
      asset.total += movement.total;
      asset.total_fee += movement.fee;
    } else if (movement.type_operation === 2) {
      asset.quantity -= movement.qtd;
      asset.total -= movement.total;
      asset.total_fee += movement.fee;
    } else if (movement.type_operation === 3) {
      asset.total_rendi += movement.total;
    } else if (movement.type_operation === 4) {

      const ratio = Number(body.to) / Number(body.from);
      asset.quantity = Number(asset.quantity) * ratio;
    }

    // Se zerou o ativo → zera totais
    if (asset.quantity <= 0) {
      asset.quantity = 0;
      asset.total = 0;
      asset.total_fee = 0;
    }

    asset.medium_price =
    asset.quantity > 0 ? round((asset.total - asset.total_fee) / asset.quantity, 3) : 0;

    await asset.save();

    return asset


  }
  public async deleteMov(ctx: HttpContextContract) {
    const id: number = ctx.params.id;
    const unfoldId: number | undefined = ctx.request.qs().unfold_id;

    const movement: any = await Movement.findOrFail(id)
    const asset = await Asset.query()
    .where('cod', movement.cod)
    .andWhere('user_id', movement.user_id)
    .firstOrFail();
    // Converte campos string para número
    movement.qtd = parseFloat(movement.qtd as any) || 0;
    movement.total = parseFloat(movement.total as any) || 0;
    movement.fee = parseFloat(movement.fee as any) || 0;

    asset.quantity = parseFloat(asset.quantity as any) || 0;
    asset.total = parseFloat(asset.total as any) || 0;
    asset.total_fee = parseFloat(asset.total_fee as any) || 0;
    asset.total_rendi = parseFloat(asset.total_rendi as any) || 0;


  // Reverte movimento no Asset
  if (movement.type_operation === 1) {
    asset.quantity -= movement.qtd;
    asset.total -= movement.total;
    asset.total_fee -= movement.fee;
  } else if (movement.type_operation === 2) {
    asset.quantity += movement.qtd;
    asset.total += movement.total;
    asset.total_fee -= movement.fee;
  } else if (movement.type_operation === 3) {
    asset.total_rendi -= movement.total;
  } else if (movement.type_operation === 4 && unfoldId) {
    const unfolding = await Unfolding.query()
    .where('id', unfoldId)
    .andWhere('user_id', movement.user_id)
    .first();
    if (unfolding) {
      const ratio = Number(unfolding.to) / Number(unfolding.from);
      asset.quantity = Number(asset.quantity) / ratio;
      await unfolding.delete();
    }
  }
  movement.updated_at = DateTime.fromJSDate(new Date())
  asset.updated_at = DateTime.fromJSDate(new Date())

  // Se zerou o ativo → zera totais
  if (asset.quantity <= 0) {
    asset.quantity = 0;
    asset.total = 0;
    asset.total_fee = 0;
  }

  asset.medium_price = asset.quantity > 0 ? round((asset.total - asset.total_fee) / asset.quantity, 3) : 0;

  await asset.save();
  await movement.delete();

  return { success: true };
}


  public async showFilteredItemsByType(ctx: HttpContextContract) {
    const year: number = ctx.params.year;
    const type: number = ctx.params.type;
    let movements: any = await Movement.query()
    .select('id', 'cod', 'date_operation', 'qtd', 'type', 'type_operation', 'unity_value', 'obs', 'fee', 'total')
    .where('year', year)
    .where('type', type)
    .preload('typeOperation', (query) =>{
      query.select('title', 'full_title')
    })
    .preload('assetsType', (query) =>{
      query.select('title', 'full_title')
    })

   const response = movements.map((el: any) => {
      return {
        id: el.id,
        cod: el.cod,
        date_operation: el.date_operation,
        qtd: el.qtd,
        unity_value: +el.unity_value,
        obs: el.obs,
        fee: +el.fee,
        total: +el.total,
        type_operation: el.typeOperation,
        type: el.assetsType
      }
    })
    return response

  }

  public async searchItems(ctx: HttpContextContract) {
    const queryParam: any = ctx.request.qs().search;
    const movements: any = await Movement.query()
    .select('id', 'cod', 'date_operation', 'qtd', 'type', 'type_operation', 'unity_value', 'obs', 'fee', 'total')
    .where('cod', 'LIKE', '%'+queryParam+'%')
    .orWhere('date_operation', 'LIKE', '%'+queryParam+'%')
    .preload('typeOperation', (query) =>{
      query.select('title', 'full_title')
    })
    .preload('assetsType', (query) =>{
      query.select('title', 'full_title')
    })
    const response = movements.map((el: any) => {
      return {
        id: el.id,
        cod: el.cod,
        date_operation: el.date_operation,
        qtd: el.qtd,
        unity_value: +el.unity_value,
        obs: el.obs,
        fee: +el.fee,
        total: +el.total,
        type_operation: el.typeOperation,
        type: el.assetsType
      }
    })
    return response
  }

}
