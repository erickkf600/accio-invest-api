import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Database from '@ioc:Adonis/Lucid/Database';
import Movement from 'App/Models/Movement';
import axios from 'axios';
export default class InvestmentsWalletsController {
  public async aportsHistory(ctx: HttpContextContract) {
    const year: number = ctx.params.year;
    const movements: any = await Movement.query()
    .groupBy('month_ref')
    .select('total', 'month_ref')
    .select(Database.raw('round(sum(total), 2) as total'))
    .where('year', year)
    .whereRaw('type_operation != ?', [3])
    .preload('month')

    const chartMap = movements.map((el: any) =>{
      const number = String(el.month_ref).padStart(2, '0');
      return {
        data: `01/${number}/${year}`,
        valor: el.total,
        month: {
          id: el.month.num,
          title: el.month.title

        }
      }
    })
    return chartMap
  }

  public async assetsList() {
    const movements: any = await Movement.query()
    .groupBy('cod')
    .select('id', 'cod', 'type')
    .preload('assetsType')

    const dividends: any = await Movement.query()
    .groupBy('cod')
    .select('total', 'cod', 'type_operation')
    .select(Database.raw('round(sum(total), 2) as total'))
    .where('type_operation', 3)



    if(movements.length){
      const symbols = movements.map((el: any) => el.cod).join('|')

      const req = await axios.get(`https://cotacao.b3.com.br/mds/api/v1/instrumentQuotation/${symbols}`)
      .then((b3) => {
        return b3.data?.Trad
      })
      .catch(() => {
        throw {
          code: 4,
          message: "Ocorreu um erro ao buscar na api cotacao.b3.com.br",
        };
      })

      const response = movements.map((res: any, i: number) =>{
        return {
          cod: res.cod,
          asset_id: res.id,
          type: res.assetsType.title,
          type_id: res.assetsType.id,
          curr_price: req?.[i]?.scty?.SctyQtn.curPrc,
          payed_dividend: dividends.find((dvd: any) => dvd.cod === res.cod)?.total || 0.0
        }
      })
      return response
    }else{
      throw {
        code: 4,
        message: "Não possui Ativos cadastrados",
      };
    }
  }
}
