import Movement from 'App/Models/Movement'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class InvestmentsMovementsController {
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
//TODO API CDI https://api.bcb.gov.br/dados/serie/bcdata.sgs.4391/dados?formato=json
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

    for await (const iterator of body) {
      if(iterator.type_operation !== 2) {
        try {
          await Movement.createMany(body)
          return true
         } catch (error) {
          throw {
            code: 4,
            message: "Ocorreu um erro ao cadastrar",
          };
         }
      }else {
       return await this.sellItem(iterator)
      }
    }
    return true
  }

  public async registerSplit(ctx: HttpContextContract) {
    const body: any = ctx.request.body()
    const movement = Movement
          .query()
          .where('cod', body.cod)
          .andWhere('type_operation', 1)

      const foundedItem = await movement

      const savePromises = foundedItem.map((el) => {
        if(body.factor === 1) {
          el.unity_value = +el.unity_value / body.to
          el.qtd = +el.qtd * body.to
          el.save();
          return true
        }else{
          return false
        }
      });
      await Promise.all(savePromises);
      if(savePromises) {
        const [_, monthRef, year] = body.date_operation.split('/')
        const savePayload = {
          cod: body.cod,
          date_operation: body.date_operation,
          qtd: 1,
          type: body.type,
          type_operation: body.operation_type,
          unity_value: 0,
          fee: 0,
          obs: body.obs,
          total: 0,
          year: +year,
          month_ref: +monthRef
        }
        await Movement.create(savePayload);
        return savePayload
      }

  }


  private async sellItem(item: any) {
    const moviment = Movement
    .query()
    .where('cod', item.cod)
    .andWhereNot('type_operation', 2)

    const foundedItem = await moviment

    foundedItem.sort((a, b) => (b.qtd > a.qtd ? -1 : 1))
    if(foundedItem.length){
      const qtd = foundedItem.reduce((acc, {qtd}) => acc + qtd, 0)
      await this.registerSell(item)
      if(item.qtd >= qtd) {
        await  moviment.delete()
      }else{
        foundedItem.map((asset: any) =>{
          if (item.qtd > 0) {
            const quantityToUpdate = Math.min(item.qtd, asset.qtd);
            item.qtd -= quantityToUpdate;
            asset.qtd -= quantityToUpdate;
            asset.total = asset.unity_value * asset.qtd;
            return asset
          }
        })
        try {
          await this.deleteZero(foundedItem.filter(del => !del.qtd))
          await this.updateWithNewValue(foundedItem.filter(el => !!el.qtd))

          return true
        } catch (error) {
          throw {
            code: 4,
            message: "Falha na execução de updade ou delete",
          };
        }
      }
    }else {
      throw {
        code: 4,
        message: `${item.cod} não encontrado na base`,
      };
    }
  }

  private async deleteZero(array: any[]){
    if(array.length) {
      const ids = array.map((item) => item.id)
      await Movement
          .query()
          .whereIn('id', ids)
          .andWhere('type_operation', 1)
          .delete()
    }
    return array
  }

  private async updateWithNewValue(array: any[]) {
    if(array.length) {
      const ids = array.map((item) => item.id)
      const movementsToUpdate = await Movement
      .query()
      .whereIn('id', ids)
      array.forEach((el, i) => {
        movementsToUpdate[i].qtd = el.qtd;
        movementsToUpdate[i].total = el.total;
      });
      const savePromises = movementsToUpdate.map((movement) => movement.save());
      await Promise.all(savePromises);
      return movementsToUpdate
    }
  }

  private async registerSell(data: any) {
    try {
      await Movement.create(data)
      return true
     } catch (error) {
      throw {
        code: 4,
        message: "Ocorreu um erro ao cadastrar",
      };
     }
  }

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

  public async deleteMov(ctx: HttpContextContract) {
    const id: number = ctx.params.id;
    const movement: any = await Movement.findOrFail(id)
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
