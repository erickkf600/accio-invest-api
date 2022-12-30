import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Database from '@ioc:Adonis/Lucid/Database';
import Movement from 'App/Models/Movement';
import Estimates from 'App/Models/Estimates';
export default class EstimatesController {

  public async show() {
    const movements: any = await Movement.query()
    .groupBy('cod')
    .select('id', 'cod', 'type', 'qtd')
    .select(Database.raw('sum(qtd) as qtd'))
    .where('type', 1)

    return movements
  }

  public async register(ctx: HttpContextContract) {
    const body: any = ctx.request.body()

    try {
      await Estimates.createMany(body)
      return true
     } catch (error) {
      throw {
        code: 4,
        message: "Ocorreu um erro ao cadastrar",
      };
     }
  }
}
