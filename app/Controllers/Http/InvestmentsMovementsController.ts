import Movement from 'App/Models/Movement'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Asset from 'App/Models/Asset';
import { chain, flatMap, groupBy, map, round, sumBy } from 'lodash';
import Unfolding from 'App/Models/Unfolding';
import moment from 'moment'
import TickerRequests from 'App/services/ticker-requests.service';
import { DateTime } from 'luxon';
import FixedIncome from 'App/Models/FixedIncome';

export default class InvestmentsMovementsController {
  private ticker = new TickerRequests()
  public async show(ctx: HttpContextContract) {
    const page: number = ctx.params.page;
    const limit: number = ctx.params.limit;
    let movements: any = await Movement.query()
    .select('id', 'cod', 'date_operation', 'qtd', 'type', 'type_operation', 'unity_value', 'obs', 'fee', 'total', 'unfold_id', 'fix_id')
    .preload('typeOperation', (query) =>{
      query.select('title', 'full_title')
    })
    .preload('assetsType', (query) =>{
      query.select('title', 'full_title')
    })
    .preload('fixedIncome', (query) => {
      query.select('id', 'emissor', 'interest_rate', 'invest_type', 'title_type', 'date_operation', 'date_expiration', 'form', 'index', 'obs', 'total', 'daily_liquidity', 'other_cost', 'rentability', 'ir')
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
      }else if(el.fixedIncome) {
        base.fixed_income = el.fixedIncome;
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
        } else if (iterator.type_operation === 3 || iterator.type_operation === 5) { // Dividendos
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
    } else if (movement.type_operation === 3 || movement.type_operation === 5) {
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
    } else if (movement.type_operation === 3 || movement.type_operation === 5) {
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
  } else if (movement.type_operation === 3 || movement.type_operation === 5) {
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
  public async registerFixedIncoming(ctx: HttpContextContract) {
    const body: any = ctx.request.body()
    const items = Array.isArray(body) ? body : [body]
    const userId = 1

    try {
      for (const iterator of items) {
        let fixedIncomes: any = null
        const { date_operation, date_expiration, value, other_cost, emissor } = iterator
        const [_, month, year] = date_operation.split('/')

        // cria o identificador único
        const cod = `${emissor.replace(/\s/g, "_")}_${date_expiration.replace(/\//g, "")}`
        // === 1) FixedIncome ===
        fixedIncomes = await FixedIncome.create({
          emissor,
          interest_rate: iterator.interest_rate,
          invest_type: iterator.invest_type,
          title_type: iterator.title_type,
          date_operation,
          date_expiration,
          form: iterator.form,
          index: iterator.index,
          obs: iterator.obs,
          total: Number(value),
          daily_liquidity: iterator.daily_liquidity ? 1 : 0,
          other_cost: Number(other_cost || 0),
          user_id: userId,
          ir: iterator.ir,
        })

        // === 2) Asset ===
        let asset = await Asset.query()
          .where('cod', cod)
          .andWhere('user_id', userId)
          .first()

        if (!asset) {
          asset = await Asset.create({
            cod,
            quantity: 1,
            total: Number(value),
            total_fee: Number(other_cost || 0),
            total_rendi: 0,
            type: 3,
            user_id: userId,
            medium_price: Number(value),
          })
        } else {
          asset.quantity = Number(asset.quantity) + 1
          asset.total = Number(asset.total) + Number(value)
          asset.total_fee = Number(asset.total_fee) + Number(other_cost || 0)
          asset.medium_price = asset.quantity > 0
            ? (asset.total - asset.total_fee) / asset.quantity
            : 0
          await asset.save()
        }

        // === 3) Movement ===
        await Movement.create({
          cod,
          date_operation,
          qtd: 1,
          type: 3,
          type_operation: 1,
          unity_value: Number(value),
          total: Number(value),
          fee: Number(other_cost || 0),
          rentability: '',
          obs: iterator.obs,
          user_id: userId,
          month_ref: +month,
          year: +year,
          fix_id: fixedIncomes?.id
        })
      }

      return { success: true }
    } catch (error) {
      console.error(error)
      throw { code: 4, message: `Erro ao cadastrar renda fixa: ${error}` }
    }
  }

  public async updateFixedIncome(ctx: HttpContextContract) {
    const id: number = ctx.params.id;
    const body: any = ctx.request.body();

    // Movement a ser atualizado
    const movement = await Movement.findOrFail(id);

     // Busca FixedIncome via chave estrangeira
    const fixedIncome = await FixedIncome.findOrFail(movement.fix_id);

    const asset = await Asset.query()
      .where("cod", movement.cod)
      .andWhere("user_id", movement.user_id)
      .firstOrFail();

    // Reverte efeito antigo no Asset
    asset.quantity -= movement.qtd;
    asset.total -= Number(movement.total);
    asset.total_fee -= Number(movement.fee);

    // Atualiza FixedIncome
    fixedIncome.merge({
      emissor: body.emissor ?? fixedIncome.emissor,
      interest_rate: body.interest_rate ?? fixedIncome.interest_rate,
      invest_type: body.invest_type ?? fixedIncome.invest_type,
      title_type: body.title_type ?? fixedIncome.title_type,
      date_operation: body.date_operation ?? fixedIncome.date_operation,
      date_expiration: body.date_expiration ?? fixedIncome.date_expiration,
      form: body.form ?? fixedIncome.form,
      index: body.index ?? fixedIncome.index,
      obs: body.obs ?? fixedIncome.obs,
      total: body.value ? Number(body.value) : fixedIncome.total,
      daily_liquidity: body.daily_liquidity !== undefined ? (body.daily_liquidity ? 1 : 0) : fixedIncome.daily_liquidity,
      other_cost: body.other_cost !== undefined ? Number(body.other_cost) : fixedIncome.other_cost,
      ir: body.ir !== undefined ? (body.ir ? 1 : 0) : fixedIncome.ir,
    });


    // Novo identificador único (caso emissor ou expiração mudem)
    const cod = `${fixedIncome.emissor.replace(/\s/g, "_")}_${fixedIncome.date_expiration.replace(/\//g, "")}`;
    const [_, monthRef, year] = fixedIncome.date_operation.split('/');

     // Atualiza Movement
    movement.merge({
      cod,
      date_operation: fixedIncome.date_operation,
      qtd: 1,
      type: 3,
      type_operation: 1,
      unity_value: fixedIncome.total,
      total: fixedIncome.total,
      fee: fixedIncome.other_cost,
      rentability: '',
      obs: fixedIncome.obs,
      month_ref: +monthRef,
      year: +year,
      updated_at: DateTime.fromJSDate(new Date()),
    });

     // Aplica efeito novo no Asset
      asset.cod = cod;
      asset.quantity += 1;
      asset.total += Number(movement.total);
      asset.total_fee += Number(movement.fee);

      if (asset.quantity <= 0) {
        asset.quantity = 0;
        asset.total = 0;
        asset.total_fee = 0;
      }

      asset.medium_price = asset.quantity > 0
        ? round((asset.total - asset.total_fee) / asset.quantity, 3)
        : 0;

      await fixedIncome.save();
      await movement.save();
      await asset.save();

      return { success: true };
  }

  public async deleteFixedIncome(ctx: HttpContextContract) {
    const id: number = ctx.params.id;

    // Movement a ser removido
    const movement = await Movement.findOrFail(id);

    // FixedIncome relacionado
    const fixedIncome = await FixedIncome.findOrFail(movement.fix_id);

     // Asset relacionado
    const asset = await Asset.query()
    .where("cod", movement.cod)
    .andWhere("user_id", movement.user_id)
    .firstOrFail();

     // Reverte movimento no Asset
    asset.quantity -= movement.qtd;
    asset.total -= Number(movement.total);
    asset.total_fee -= Number(movement.fee);

    if (asset.quantity <= 0) {
      asset.quantity = 0;
      asset.total = 0;
      asset.total_fee = 0;
    }

    asset.medium_price = asset.quantity > 0
    ? round((asset.total - asset.total_fee) / asset.quantity, 3)
    : 0;

    await asset.save();

    // Apaga registros
    await movement.delete();
    await fixedIncome.delete();
    return { success: true };
  }

  public async registerFixedIncomingRendiment(ctx: HttpContextContract) {
    const userId = 1
    const body: any = ctx.request.body()

    try {
      const movement = await Movement.query()
        .where("cod", body.emissor)
        .andWhere("user_id", userId)
        .firstOrFail();

        const fixedIncomes = await FixedIncome.query()
        .where("id", movement.fix_id)
        .andWhere("user_id", userId)
        .firstOrFail();

      const asset = await Asset.query()
        .where("cod", movement.cod)
        .andWhere("user_id", userId)
        .firstOrFail();


      asset.total_rendi = (Number(asset.total_rendi) || 0) + Number(body.total);
      fixedIncomes.rentability = parseFloat(((body.total / +fixedIncomes.total) * 100).toFixed(6))
      const [_, month, year] = body.date_operation.split('/')
      await Movement.create({
        cod: body.emissor,
        date_operation: body.date_operation,
        qtd: 1,
        type: 3,
        type_operation: 3,
        unity_value: Number(body.total),
        total: Number(body.total),
        fee: movement.fee,
        rentability: ((body.total / +movement.total) * 100).toFixed(6),
        obs: movement.obs,
        user_id: userId,
        month_ref: +month,
        year: +year,
        fix_id: fixedIncomes?.id
      })
      await fixedIncomes.save()
      await asset.save()
      return { success: true }

    } catch (error) {
      console.error(error)
      throw { code: 4, message: `Erro ao cadastrar rendimento de renda fixa: ${error}` }
    }
  }

  public async updateFixedIncomingRendiment(ctx: HttpContextContract) {
    const id: number = ctx.params.id;
    const body: any = ctx.request.body();

    const movement = await Movement.findOrFail(id);
    const fixedIncome = await FixedIncome.findOrFail(movement.fix_id);

    const asset = await Asset.query()
    .where("cod", movement.cod)
    .andWhere("user_id", movement.user_id)
    .firstOrFail();

    asset.total_rendi -= Number(movement.total);

    const rent = parseFloat(((body.total / +fixedIncome.total) * 100).toFixed(6))
    asset.total_rendi = (Number(asset.total_rendi) || 0) + Number(body.total);

    const [_, month, year] = body.date_operation.split('/')
    fixedIncome.merge({
      emissor: body.emissor ?? fixedIncome.emissor,
      date_operation: body.date_operation ?? fixedIncome.date_operation,
      rentability: rent
    });

    movement.merge({
      cod: body.emissor ?? movement.cod,
      date_operation: body.date_operation ?? movement.date_operation,
      qtd: 1,
      type: 3,
      type_operation: 3,
      unity_value: Number(body.total) ?? movement.unity_value,
      total: Number(body.total) ?? movement.total,
      fee: movement.fee,
      rentability: ((body.total / +body.base_value) * 100).toFixed(6) ?? movement.rentability,
      obs: movement.obs,
      month_ref: +month,
      year: +year,
      updated_at: DateTime.fromJSDate(new Date()),
    });

    await fixedIncome.save();
    await movement.save();
    await asset.save();

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
