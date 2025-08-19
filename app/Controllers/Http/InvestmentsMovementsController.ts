import Movement from 'App/Models/Movement'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Asset from 'App/Models/Asset';
import { chain, flatMap, groupBy, map, round, sumBy } from 'lodash';
import Unfolding from 'App/Models/Unfolding';
import moment from 'moment'
import TickerRequests from 'App/services/ticker-requests.service';

export default class InvestmentsMovementsController {
  private ticker = new TickerRequests()
  public async show(ctx: HttpContextContract) {
    const page: number = ctx.params.page;
    const limit: number = ctx.params.limit;
    let movements: any = await Movement.query()
    .select('id', 'cod', 'date_operation', 'qtd', 'type', 'type_operation', 'unity_value', 'obs', 'fee', 'total')
    .preload('typeOperation', (query) =>{
      query.select('title', 'full_title')
    })
    .preload('assetsType', (query) =>{
      query.select('title', 'full_title')
    })
    .orderBy('year', 'desc')
    .orderBy('month_ref', 'desc')
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
    const userId = 1 // TODO: capturar userid do token jwt


    const toCreate: any[] = []
    const toUpdate: any[] = []
    const movements: any[] = []
    const unfoldings: any[] = []


    // === Preparar dividendos para rentability ===
    const rentabilityPayload: any[] = []

    let isSell = false

    try {
      // === Separar ações por tipo e preparar dados ===
      for (const iterator of items) {
        if (iterator.type_operation === 1) {
          // Compra
          const hasAsset = await Asset.findBy("cod", iterator.cod)
          if (!hasAsset) {
            toCreate.push({
              cod: iterator.cod,
              quantity: iterator.qtd,
              total: iterator.total,
              total_rendi: 0,
              type: iterator.type,
              total_fee: iterator.fee
            })
          } else {
            toUpdate.push({
              cod: iterator.cod,
              quantity: iterator.qtd,
              total: iterator.total,
              total_fee: iterator.fee
            })
          }
        } else if (iterator.type_operation === 2) {
          // Venda
          isSell = true
          toUpdate.push({
            cod: iterator.cod,
            quantity: -iterator.qtd, // subtrai
            total: -iterator.total,
            total_fee: iterator.fee
          })
        } else if (iterator.type_operation === 3) {
          // Dividendos
          toUpdate.push({
            cod: iterator.cod,
            total_rendi: iterator.total,
          })
          // cria o payload para busca de proventos
          rentabilityPayload.push({
            dataInicio: moment(iterator.date_operation, "DD/MM/YYYY").format("YYYY-MM-DD"),
            dataFim: moment(iterator.date_operation, "DD/MM/YYYY").format("YYYY-MM-DD"),
            papeis_tipos: [
              {
                papel: iterator.cod,
                tipo: iterator.type
              }
            ]
          })
        } else if (iterator.type_operation === 4) {
          // Desdobramento / Grupamento
          unfoldings.push({
            cod: iterator.cod,
            date_operation: iterator.date_operation,
            from: iterator.from,
            to: iterator.to,
            factor: iterator.factor,
            obs: iterator.obs,
            user_id: userId,
            total: iterator.total || 0,
            year: new Date(iterator.date_operation).getFullYear(),
          })

          const asset = await Asset.findBy("cod", iterator.cod)
          if (asset) {
            let ratio = 1

            if (iterator.factor === 1) {
              // Desdobramento
              ratio = Number(iterator.to) / Number(iterator.from)
            } else if (iterator.factor === 2) {
              // Grupamento
              ratio = Number(iterator.to) / Number(iterator.from)
            }

            if (ratio !== 1) {
              asset.quantity = Number(asset.quantity) * ratio
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
          year: +iterator.date_operation.split('/')[2]

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
          quantity: quantity,
          total: total,
          total_fee: total_fee,
          total_rendi: 0,
          type: items[0].type,
          medium_price: quantity > 0 ? round((total - total_fee) / quantity, 3) : 0,
        }
      })
      if (createData.length > 0) {
        await Asset.createMany(createData)
      }

      // === UPDATE Assets ===
      const groupedUpdate = groupBy(toUpdate, "cod")
      const updates = Object.entries(groupedUpdate).map(async ([cod, items]) => {
        const asset = await Asset.findByOrFail("cod", cod)
        const qtdDelta = sumBy(items, (i: any) => i.quantity ?? 0)
        const totalDelta = sumBy(items, (i: any) => i.total ?? 0)
        const rendiDelta = sumBy(items, (i: any) => i.total_rendi ?? 0)
        const feeDelta = sumBy(items, (i: any) => i.total_fee ?? 0)

        asset.quantity = Number(asset.quantity ?? 0) + qtdDelta
        asset.total = Number(asset.total ?? 0) + totalDelta
        asset.total_rendi = Number(asset.total_rendi ?? 0) + rendiDelta
        asset.total_fee = Number(asset.total_fee ?? 0) + feeDelta

        if (qtdDelta > 0 || isSell) {
          asset.medium_price = asset.quantity > 0
            ? round((asset.total - asset.total_fee) / asset.quantity, 3)
            : 0
          isSell = false
        }
        return asset.save()
      })
      await Promise.all(updates)

      // === CREATE Unfoldings ===
      if (unfoldings.length > 0) {
        await Unfolding.createMany(unfoldings)
      }

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
      throw {
        code: 4,
        message:  `Ocorreu um erro ao cadastrar ${error}`,
      };
    }


    return { success: true }
  }



  // TODO REVER COMO VAI SER O UPDATE
  public async update(ctx: HttpContextContract) {
    const id: number = ctx.params.id;
    const body: any = ctx.request.body()[0]

    const [_, monthRef, year] = body.date_operation.split('/')

    const movement: any = await Movement.findOrFail(id)

    movement.cod = body.cod || movement.cod
    movement.date_operation = body.date_operation || movement.date_operation
    movement.qtd = body.qtd || movement.qtd
    movement.type = body.type || movement.type
    movement.type_operation = body.type_operation || movement.type_operation
    movement.unity_value = body.unity_value || movement.unity_value
    movement.obs = body.obs || movement.obs
    movement.fee = body.fee || movement.fee
    movement.total = body.total || movement.total
    movement.month_ref = +monthRef || movement.month_ref
    movement.year = +year || movement.year
    movement.updated_at = new Date().toISOString()
    await movement.save()
    return movement;
  }
  // TODO REVER COMO VAI SER O DELETE
  public async deleteMov(ctx: HttpContextContract) {
    const id: number = ctx.params.id;
    const movement: any = await Movement.findOrFail(id)
    // const asset: any = await Asset.findBy("cod", movement.cod)
    // asset.quantity = movement
    // asset.total = 0
    await movement.delete()
    return true
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
