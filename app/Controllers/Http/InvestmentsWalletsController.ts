import Env from '@ioc:Adonis/Core/Env';
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import Database from '@ioc:Adonis/Lucid/Database';
import Asset from 'App/Models/Asset';
import Movement from 'App/Models/Movement';
import AccumulativeCalc from 'App/services/accumulative-calc';
import axios from 'axios';
import { groupBy, keyBy, map } from 'lodash';

export default class InvestmentsWalletsController {
  private accumulationCacl = new AccumulativeCalc()
  private async accioTickerEarningsRequest(body: any){
    const req = await axios.post(`${Env.get('TICKER_HOST')}/proventos`, body)
    .then(({ data }) => data)
    .catch((error) => {
        throw {
            code: 4,
            message: `Erro na API ${Env.get('TICKER_HOST')}`,
            details: error.response?.data || error.message,
            status: error.response?.status
        };
    });

    return req
}
  public async accioTickerRequest(symbols: any){
      const req = await axios.get(`${Env.get('TICKER_HOST')}/tickers?ticker=${symbols}`)
      .then(({data}) => {
        return data
      })
      .catch(() => {
        throw {
          code: 4,
          message: `Ocorreu um erro ao buscar na api ${Env.get('TICKER_HOST')}`,
        };
      })

      return req
  }
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
  public async assetsList() {
    const movements: any = await Movement.query()
    .select('id', 'cod', 'type', 'qtd', 'total')
    .groupBy('cod')
    .select(Database.raw('round(sum(total), 2) as total'))
    .where('type_operation', 1)
    .select(Database.raw('round(sum(qtd), 2) as qtd'))
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
          total: this.convertThousand(+res.total)
        }
      })
      return response
    }else{
      return [];
    }
  }


  public async dividendsList() {
    const dividends: any = await Movement.query()
    .select('cod', 'date_operation', 'qtd', 'unity_value', 'total', 'type', 'year', 'month_ref')
    .where('type_operation', 3)
    .orderBy('year', 'desc')
    .orderBy('month_ref', 'desc')
    .preload('assetsType')

    const response = dividends.map((res: any) =>{
      return {
        cod: res.cod,
        date_operation: res.date_operation,
        qtd: res.qtd,
        type: res.assetsType.title,
        unity_value: +res.unity_value,
        total: +res.total,
        month_ref: res.month_ref,
        year: res.year,
      }
    })
    return response
  }


  public async patrimonyGainList(order: string = 'asc', query?: any) {
    const movements = await Movement.query()
    .select('cod', 'month_ref', 'year', 'type_operation', 'total', 'rentability', 'qtd')
    .orderBy('year', 'asc')
    .orderBy('month_ref', 'asc')
    .whereIn('type_operation', [1,3])

    const grouped = groupBy(movements, item => `${item.month_ref}-${item.year}-${item.type_operation}`);

    const resultGrouped = map(grouped, (items, key) => {
      const [month_ref, year, type_operation] = key.split("-").map(Number);
      const total = items.reduce((sum, i: any) => sum + parseFloat(i.total), 0);

      const tickersGrouped = map(groupBy(items, "cod"), (_, cod) => {
        return cod;
      });

      return {
        month_ref,
        year,
        type_operation,
        total: total.toFixed(2),
        tickers: tickersGrouped
      };
    });
    const purchase = resultGrouped.filter((p) => p.type_operation === 1)
    // todo capturar o preço medio do Asset e criar um preco_medio_total que vai ser a soma de todos os preços medios
    const tickers = purchase.map((el) => el.tickers)
    // const mediumPriceList = tickers.map(async (cod) => {
    //   const asset = await Asset.findByOrFail("cod", cod)
    //   return asset
    // })
    // return await Promise.all(mediumPriceList)
    return purchase
    const dividends = resultGrouped.filter((p) => p.type_operation === 3)

    const accumulated = await this.accumulationCacl.someTotais(purchase.map(el => el.total))
    const aportsIncrement = purchase.map(({year, month_ref}: any, i: number) => {
      return {
        year,
        month_ref,
        total: accumulated[i]
      }
    });

    // logica para a rentabilidade
    // 1️⃣ Cria um dicionário de dividendos com chave "year-month"
    const dividendMap = keyBy(dividends, d => `${d.year}-${d.month_ref}`);

    // 2️⃣ Percorre os aportes e junta os dividendos + rentabilidade
    const result = map(aportsIncrement, a => {
      const key = `${a.year}-${a.month_ref}`;
      const dividendTotal = dividendMap[key] ? parseFloat(dividendMap[key].total) : 0;
      const aportTotal = parseFloat(a.total);
      const rentability = aportTotal > 0 ? (dividendTotal / aportTotal) * 100 : 0;

      return {
        ...a,
        dividend_total: dividendTotal.toFixed(2),
        rentability: rentability.toFixed(2) + "%"
      };
    });

    return result




  //   let movements

  //   if(!query) {
      // movements = await Movement.query()
      // .select('month_ref', 'year', 'type_operation', 'total')
      // .select(Database.raw('round(sum(total), 2) as total'))
      // .groupBy('month_ref', 'year', 'type_operation')
      // .orderBy('year', 'asc')
      // .orderBy('month_ref', 'asc')
      // .whereIn('type_operation', [1,3])
  //   }else{
  //     movements = query
  //   }

  //   const dividends = movements.filter((el: any) => el.type_operation === 3)
  //   const mov = movements.filter((el: any) => el.type_operation === 1)
  //   let sum = 0
    // const aportsIncremet = mov.map(({total, year, month_ref}: any) => {
    //   sum = sum + Number(total)
    //   return {
    //     year,
    //     month_ref,
    //     total: sum
    //   }
    // });

  //  let lastValidValue: any = null;

  //   const response = dividends.map((el: any) =>{
  //     const valIndex = aportsIncremet.findIndex((val: any) => val.month_ref === el.month_ref && val.year === el.year)
  //     let aport = aportsIncremet[valIndex]?.total || 0

  //     const dividend = el.total || 0
  //     const lastAport = mov.find(v => v.month_ref === el.month_ref && v.year === el.year)?.total || 0
  //     if (aport) {
  //       lastValidValue = aport
  //     } else aport = lastValidValue;

  //     const finalValue = aport-lastAport
  //     const rentability = parseFloat(Math.abs(dividend / finalValue * 100).toString()).toFixed(2)

  //     return {
  //       month: `${el.month_ref}/${el.year.toString().substr(-2)}`,
  //       value: finalValue,
  //       dividend: dividend,
  //       rent: rentability+'%',
  //     }
  //   })
  //   response.sort((a, b) => {
  //     const [monthA, yearA] = a.month.split('/');
  //     const [monthB, yearB] = b.month.split('/');
  //     return order === 'asc' ? yearB - yearA || monthB - monthA : yearA - yearB || monthA - monthB;
  // });

  //   return response
  }

  public async VariationsList() {
    const movements: any = await Movement.query()
    .select('cod', 'type', 'unity_value', 'date_operation')
    .select(Database.raw('ROUND(SUM(CASE WHEN type_operation = 1 THEN qtd ELSE 0 END), 2) as qtd'))
    .select(Database.raw('ROUND(SUM(CASE WHEN type_operation = 1 THEN fee ELSE 0 END), 2) as fee'))
    .select(Database.raw('ROUND(SUM(CASE WHEN type_operation = 1 THEN total ELSE 0 END), 2) as total'))
    .select(Database.raw('ROUND(SUM(CASE WHEN type_operation = 3 THEN total ELSE 0 END), 2) as dividends'))
    .whereIn('type_operation', [1, 3])
    .preload('assetsType')
    .groupBy('cod');

    if(movements.length){
      const symbols = movements.map((el: any) => el.cod).join('-')
      const request = await this.accioTickerRequest(symbols)
      let response: any = []
      movements.forEach((res: any, i: number) =>{
        res.qtd = +res.qtd
        res.total = +res.total
        res.unity_value = +res.unity_value
        res.fee = +res.fee
        res.dividends = +res.dividends

        const medium_price = (res.total - res.fee) / res.qtd
        const currentTotal = (request?.[i]?.curPrc * res.qtd) + res.fee
        const bal = currentTotal - res.total
        const rel = Math.sign(bal) === 1 ? '+' : (Math.sign(bal) === 0 ? '' : '-')
        const percent = parseFloat((((request?.[i]?.curPrc - medium_price) / medium_price) * 100).toFixed(2))+'%'
        if(res.type == 1 || res.type == 2){
          response.push({
            cod: res.cod,
            qtd: res.qtd,
            type: res.assetsType.title,
            curr_price: request?.[i]?.curPrc,
            total_purch: +res.total,
            current_total: parseFloat(currentTotal.toFixed(2)),
            balance: parseFloat(bal.toFixed(2)),
            percet:percent,
            ralation: rel,
            medium_price: parseFloat(medium_price.toFixed(2)),
            dividends: res.dividends
          })
        }
      })

     return response
    }

    return []

  //   const newValue: any = []
  //   const lookupObject: any = {}
  //   Object.keys(movements).forEach(key => {
  //     lookupObject[movements[key]['cod']] = movements[key]
  //  })

  //  Object.keys(lookupObject).forEach((key: any) => {
  //   newValue.push(lookupObject[key])
  // })

  //   if(newValue.length){
  //     const symbols = newValue.map((el: any) => el.cod).join('-')

  //     const request = await this.accioTickerRequest(symbols)
  //     let response: any = []
  //     newValue.forEach((res: any, i: number) =>{
  //       const bal = request?.[i]?.curPrc * res.qtd - res.total
  //       const rel = Math.sign(bal) === 1 ? '+' : (Math.sign(bal) === 0 ? '' : '-')
  //       const percent = rel+parseFloat(Math.abs(bal / res.total * 100).toString()).toFixed(2)+'%'
  //       if(res.type == 1 || res.type == 2){
  //         response.push({
  //           cod: res.cod,
  //           qtd: res.qtd,
  //           purchase_price: +res.unity_value,
  //           type: res.assetsType.title,
  //           curr_price: request?.[i]?.curPrc,
  //           total_purch: +res.total,
  //           current_total: request?.[i]?.curPrc * res.qtd,
  //           balance: bal,
  //           ralation: rel,
  //           percet:percent
  //         })
  //       }
  //     })
  //     return response
  //   }

    return []
  }

  public async DividendsGraph(ctx: HttpContextContract) {
    const year: number = ctx.params.year;
    const dividendsCurrent: any = await Movement.query()
    .select('cod', 'date_operation', 'qtd', 'unity_value', 'type', 'year', 'month_ref', 'type_operation')
    .select(Database.raw('round(sum(total), 2) as total'))
    .where('type_operation', 3)
    .groupBy('year', 'month_ref')
    .preload('assetsType')
    .preload('month')

    const lastYear = dividendsCurrent.filter((el) => el.year == +year-1)
    const currentYear = dividendsCurrent.filter((el) => el.year == year)

    const responseLastYear = lastYear.map((res: any) =>{
      return {
        data: res.date_operation.slice(3),
        label: res.month.title,
        valor: +res.total,
        ano: res.year
      }
    })
    const responseCurrentYear = currentYear.map((res: any) =>{
      return {
        data: res.date_operation.slice(3),
        label: res.month.title,
        valor: +res.total,
        ano: res.year
      }
    })
    return [responseLastYear, responseCurrentYear]
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

  public async earnings(ctx: HttpContextContract) {
    const body: any = ctx.request.body()

    const movements: any = await Movement.query()
    .select('id', 'cod', 'type', 'qtd', 'total')
    .groupBy('cod')
    .select(Database.raw('round(sum(total), 2) as total'))
    .where('type_operation', 1)
    .select(Database.raw('round(sum(qtd), 2) as qtd'))
    if(movements.length) {
      const payload = Object.assign(body, {
        papeis_tipos: movements.map((mov) => ({
          papel: mov.cod,
          tipo: mov.type
        }))
      })
      const req = await this.accioTickerEarningsRequest(payload)

      const flattened = req.flatMap(item =>
        item.proventos.map(p => ({
          payment_date: p.payment_date,
          ticker: item.ticker,
          percent: p.percent,
          value: p.value,
          date_com: p.date_com
        }))
      );

      // 2. Agrupar por payment_date
      const grouped = groupBy(flattened, 'payment_date');

      const result = Object.entries(grouped).map(([payment_date, dividends]) => ({
        payment_date,
        dividends: dividends.map(({ payment_date, ...rest }) => rest)
      }))

      return result
    }

    return []

  }
}
