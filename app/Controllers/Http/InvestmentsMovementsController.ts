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

    try {
      await Movement.createMany(body)
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
    const body: any = ctx.request.body()

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
