import Database from '@ioc:Adonis/Lucid/Database';
import Movement from 'App/Models/Movement';
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import axios from 'axios';
export default class InvestmentsWalletsController {

  public async b3Rquest(symbols: any){
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

      return req
  }
  public async aportsHistory() {
    const movements: any = await Movement.query()
    .select('month_ref', 'year')
    .select(Database.raw('group_concat(cod, ",") as cod'))
    .select(Database.raw('group_concat(total, ",") as unity_value'))
    .select(Database.raw('group_concat(qtd, ",") as qtd'))
    .select(Database.raw('group_concat(fee, ",") as fee'))
    .select(Database.raw('round(sum(total), 2) as total'))
    .where('type_operation', 1)
    .groupBy('month_ref')
    .preload('month')

    const chartMap = movements.map((el: any) =>{
      // const number = String(el.month_ref).padStart(2, '0');
      const cods = el.cod.split(',')
      const vals = el.unity_value.split(',')
      const qtds = el.qtd.split(',')
      const fees = el.fee.split(',')
      let sum = 0
      const setItem = cods.map((cd: any, i: number) =>{
        sum += +fees[i]
        return {
          asset: cd,
          value:+vals[i] + +fees[i],
          qtd: +qtds[i],
          fee: +fees[i]
        }
      })
      return {
        value: el.total,
        month: `${el.month.title}/${el.year}`,
        month_num: el.month.num,
        items: setItem,
        total_fees: el.total + sum,
        fees: sum
      }
    })
    return chartMap
  }

  public async assetsList() {
    const movements: any = await Movement.query()
    .groupBy('cod')
    .select('id', 'cod', 'type', 'qtd', 'total')
    .select(Database.raw('sum(qtd) as qtd'))
    .where('type_operation', 1)
    .preload('assetsType')

    const dividends: any = await Movement.query()
    .groupBy('cod')
    .select('total', 'cod', 'type_operation')
    .select(Database.raw('round(sum(total), 2) as total'))
    .where('type_operation', 3)

    if(movements.length){
      const symbols = movements.map((el: any) => el.cod).join('|')

      const req = await this.b3Rquest(symbols)

      const response = movements.map((res: any) =>{
        const b3 = req.find((ser: any) => ser.scty?.symb === res.cod)
        return {
          cod: res.cod,
          asset_id: res.id,
          qtd: res.qtd,
          type: res.assetsType.title,
          type_id: res.assetsType.id,
          curr_price: b3?.scty?.SctyQtn.curPrc || '_._',
          payed_dividend: dividends.find((dvd: any) => dvd.cod === res.cod)?.total || 0.0,
          total: this.convertThousand(res.total)
        }
      })
      return response
    }else{
      return [];
    }
  }


  public async dividendsList() {
    const dividends: any = await Movement.query()
    .select('cod', 'date_operation', 'qtd', 'unity_value', 'total', 'type')
    .where('type_operation', 3)
    .preload('assetsType')

    const response = dividends.map((res: any) =>{
      return {
        cod: res.cod,
        date_operation: res.date_operation,
        qtd: res.qtd,
        type: res.assetsType.title,
        unity_value: res.unity_value,
        total: res.total
      }
    })
    return response
  }

  public async patrimonyGainList() {
    const movements: any = await Movement.query()
    .groupBy('month_ref')
    .select('total', 'month_ref')
    .select(Database.raw('round(sum(total), 2) as total'))
    .where('type_operation', 1)

    const dividends: any = await Movement.query()
    .groupBy('month_ref')
    .select('total', 'month_ref', 'type_operation')
    .select(Database.raw('round(sum(total), 2) as total'))
    .where('type_operation', 3)

    let sum
    const aportsIncremet = movements.map(({total}: any) => sum = (sum || 0) + total);
    const response = movements.map((el: any, i: number) =>{
      const dividend = dividends[i]?.total || 0
      const rentability = parseFloat(Math.abs(dividend / aportsIncremet[i] * 100).toString()).toFixed(2)
      return {
        month: el.month_ref,
        value: aportsIncremet[i],
        dividend: dividend,
        rent: rentability+'%',
      }
    })


    return response
  }

  public async VariationsList() {
    const movements: any = await Movement.query()
    .select('cod', 'type', 'unity_value', 'date_operation', 'total', 'qtd')
    .where('type_operation', 1)
    // .select(Database.raw('sum(qtd) as qtd'))
    // .select(Database.raw('max(id) as id'))
    // .select(Database.raw('sum(CASE WHEN type_operation = 1 then qtd END) as qtd'))
    // .groupBy('cod')
    .preload('assetsType')
    // let holder = {}

    // movements.forEach((d: any) => {
    //   if (holder.hasOwnProperty(d.cod)) {
    //     holder[d.cod] = holder[d.cod] + d.total;
    //   } else {
    //     holder[d.cod] = d.total;
    //   }
    // });

    // const newMovements = movements.map((el: any) =>{
    //   return Object.assign(el, {total: holder[el.cod]})
    // })

    const newValue: any = []
    const lookupObject: any = {}
    Object.keys(movements).forEach(key => {
      lookupObject[movements[key]['cod']] = movements[key]
   })

   Object.keys(lookupObject).forEach((key: any) => {
    newValue.push(lookupObject[key])
  })

    if(newValue.length){
      const symbols = newValue.map((el: any) => el.cod).join('|')
      const request = await this.b3Rquest(symbols)
      let response: any = []
      newValue.forEach((res: any, i: number) =>{
        const bal = request?.[i]?.scty?.SctyQtn.curPrc * res.qtd - res.total
        const rel = Math.sign(bal) === 1 ? '+' : (Math.sign(bal) === 0 ? '' : '-')
        const percent = rel+parseFloat(Math.abs(bal / res.total * 100).toString()).toFixed(2)+'%'
        if(res.type == 1 || res.type == 2){
          response.push({
            cod: res.cod,
            qtd: res.qtd,
            purchase_price: res.unity_value,
            type: res.assetsType.title,
            curr_price: request?.[i]?.scty?.SctyQtn.curPrc,
            total_purch: res.total,
            current_total: request?.[i]?.scty?.SctyQtn.curPrc * res.qtd,
            balance: bal,
            ralation: rel,
            percet:percent
          })
        }
      })
      return response
    }

    return []
  }

  public async DividendsGraph(ctx: HttpContextContract) {
    const year: number = ctx.params.year;
    const dividendsCurrent: any = await Movement.query()
    .groupBy('month_ref')
    .select('cod', 'date_operation', 'qtd', 'unity_value', 'type', 'year', 'month_ref')
    .select(Database.raw('round(sum(total), 2) as total'))
    .where('type_operation', 3)
    .andWhere('year', year)
    .preload('assetsType')
    .preload('month')

    const dividendsPrevious: any = await Movement.query()
    .groupBy('month_ref')
    .select('cod', 'date_operation', 'qtd', 'unity_value', 'total', 'type', 'year', 'month_ref')
    .select(Database.raw('round(sum(total), 2) as total'))
    .where('type_operation', 3)
    .andWhere('year', (+year-1))
    .preload('assetsType')
    .preload('month')


    const lastYear = dividendsPrevious.map((res: any) =>{
      return {
        data: res.date_operation,
        label: res.month.title,
        valor: res.total,
        ano: res.year
      }
    })
    const currentYear = dividendsCurrent.map((res: any) =>{
      return {
        data: res.date_operation,
        label: res.month.title,
        valor: res.total,
        ano: res.year
      }
    })

    return [lastYear, currentYear]
  }

  public convertThousand(num: any){
    // num = num.toString().replace(/[^0-9.]/g, '');
    if (num < 1000) {
        return num;
    }
    let si = [
      {v: 1E3, s: "K"},
      {v: 1E6, s: "M"},
      {v: 1E9, s: "B"},
      {v: 1E12, s: "T"},
      {v: 1E15, s: "P"},
      {v: 1E18, s: "E"}
      ];
    let index;
    for (index = si.length - 1; index > 0; index--) {
        if (num >= si[index].v) {
            break;
        }
    }
    return (num / si[index].v).toFixed(2).replace(/\.0+$|(\.[0-9]*[1-9])0+$/, "$1") + si[index].s;
  }
}
