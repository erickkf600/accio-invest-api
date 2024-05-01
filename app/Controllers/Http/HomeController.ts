import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Movement from 'App/Models/Movement'
import Database from '@ioc:Adonis/Lucid/Database'
import axios from 'axios'
import InvestmentsWalletsController from './InvestmentsWalletsController'


export default class HomeController {

  public async b3Rquest(symbols: any){
    const req = await axios.get(`https://cotacao.b3.com.br/mds/api/v1/instrumentQuotation/${symbols}`)
    .then((b3) => {
      return b3.data?.Trad
    })
    .catch(() => {
      return [];
    })

    return req
}
public async cdiRequest(year: any){
  const req = await axios.get(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.4391/dados?formato=json&dataInicial=01/01/${year}&dataFinal=31/12/${year}`)
  .then((cdi) => {
    return cdi.data
  })
  .catch(() => {
    return [];
  })

  return req
}

  public async showHome(_ctx: HttpContextContract) {
    const movements: any = await Movement.query()
    .select('id', 'total', 'fee', 'month_ref', 'unity_value', 'cod', 'date_operation', 'qtd', 'type_operation', 'type')
    .orderBy('year', 'desc')
    .orderBy('month_ref', 'desc')
    .whereNot('type_operation', 2)
    .preload('assetsType', (query) =>{
      query.select('title', 'full_title', 'hex')
    })
    .preload('month')


    await movements.forEach((el: any) => {
      el.date_operation = el.date_operation.slice(-7)
      el.type = el.assetsType.title
      el.hex = el.assetsType.hex
      el.total = +el.total
      el.fee = +el.fee
      el.unity_value = +el.unity_value
    })
    if(!movements.length) return {resume: [], alocations: [], distribuition: [], aports: []}

    const resume = await this.resume(movements)

    const alocations = await this.removeDupliWithSum(movements, 1, 'type');
    const distribuition = await this.distribuition(movements)
    const aports = await this.AportsGraph()
    return {resume, alocations, distribuition, aports}
  }

//TODO REVER COMO SE CALCULA O RENDIMENTO
  private async resume(array: any){

    const total = await this.sumValues(array)

    const groupArrays = await this.arrayGroup(array)
    const groupArraysDividends = this.arrayGroup(array, 3)
    const lastAport = groupArrays.reduce((acc: any, {total}: any) => acc + total, 0)
    const lastDividends = groupArraysDividends.reduce((acc: any, {total}: any) => acc + total, 0)

    const patrimony = await this.getPatrimony(array)

    return {
      total: total,
      last: lastAport,
      last_dividend: lastDividends,
      patrimony
    }
  }

  private async distribuition(array: any){
    let result: any = []
    const res: any = await this.removeDupliWithSum(array);
    res.forEach((el: any) =>{
      if(el.type !== 'Renda Fixa'){
        result.push({
          title: el.type === 'FIIs' || el.type === 'Ações' ? el.cod : el.type,
          qtd: el.qtd,
          hex: this.hexGenerator()
        })
      }
    })
    return result;
  }

  private sumValues(array: any, type: number = 1, key: string = 'total') {
    return array.reduce((acc: any, el: any) => {
      if(el.type_operation == type){
        return acc + el[key]
      }
      return acc
    }, 0)
  }
  private arrayGroup(array: any, type: number = 1, key: string = 'date_operation') {
    const onlyPurchase = array.filter((arr: any) => arr.type_operation === type) || []
    const groups = onlyPurchase.reduce((acc: any, el: any) => {
      (acc[el[key]] = acc[el[key]] || []).push(el);
      return acc;
    }, {})

    if(Object.keys(groups).length){
      const groupsOrder = Object.keys(groups).reduce((a, b) => {
        return new Date(b) > new Date(a) ? b : a;
      });

      return groups[groupsOrder]
    }

  return {}
  }

  private removeDupliWithSum(array, operation: number = 1, key: string = 'cod', key_sum: string = 'qtd'){
    let result: any = [];
    array.reduce(function(res: any, value: any) {
      if(value.type_operation === operation){
        if (!res[value[key]]) {
          res[value[key]] = { [key]: value[key], [key_sum]: 0, total: 0, hex: '' };
          result.push(res[value[key]])
        }
        res[value[key]][key_sum] += value[key_sum];
        res[value[key]]['total'] += value.total;
        res[value[key]]['hex'] = value.hex;
        res[value[key]]['type'] = value.type;
      }
      return res;
    }, {});

    return result;
  }


  private async getPatrimony(array: any) {

    const realValue: number[] = []
    const result: any = await this.removeDupliWithSum(array);
    // const totalOfAssets = await this.sumValues(array, 1, 'qtd')
    // const assets = array.map((el: any) => {if(el.type_operation == 1) return el.qtd})
    // const symbols = cods.reduce((acc: any, r: any) => {if(acc.indexOf(r)<0)acc.push(r);return acc;},[])

    const symbols = result.map((el: any) => el.cod)
    const valuesReq = await this.b3Rquest(symbols.join('|'))


    const pricing = valuesReq.map((req: any) => req.scty?.SctyQtn.curPrc)
    // return valuesReq.map((req: any) => {
    //   return {
    //     value: req.scty?.SctyQtn.curPrc,
    //     simbol: req.scty?.symb
    //   }
    // })

    result.forEach((res: any, i: number) =>{
      realValue.push(Number(pricing[i] * res.qtd) || res.total)
    })

    return realValue.reduce((acc: number, val: number) => acc + val, 0)
  }

  public async AportsGraph() {
    const year = new Date().getFullYear()
    const dividendsCurrent: any = await Movement.query()
    .select('cod', 'date_operation', 'qtd', 'unity_value', 'type', 'year', 'month_ref', 'type_operation')
    .select(Database.raw('round(sum(total), 2) as total'))
    .where('type_operation', 1)
    .groupBy('year', 'month_ref')
    .preload('assetsType')
    .preload('month')

    const lastYear = dividendsCurrent.filter((el) => el.year == year-1)
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


  public hexGenerator = () => {
    let str = '#'
    while (str.length < 7) {
        str += Math.floor(Math.random() * 0x10).toString(16)
    }
    return str
}

public async getCDIComparation(ctx: HttpContextContract) {

  const year: number = ctx.params.year;
  const cdi = await this.cdiData(year)
  const myValue = await this.myResturnAsset(year)
  return [cdi, myValue]
}

private async myResturnAsset(year: any) {
  const investmetControl = new InvestmentsWalletsController()
  const myReturns: any = await investmetControl.patrimonyGainList('desc')
  const returnByYear = myReturns.filter((item) => Number(`20${item.month.split('/')[1]}`) == year)
  const newValue = [...Array(12)].map((_, i: number) =>{
    const val = {
      data: `${i + 1}/${year.slice(2)}`,
      valor: null,
    }
    const founded = returnByYear.find(e =>  e.month == val.data)
    if(founded) {
      val.valor = +founded?.rent.replace('%', '') as any
    }
    return val
  })


  return newValue
}

  private async cdiData(year: number) {
    const cdiPercent = await this.cdiRequest(year)

  return cdiPercent.map((el) =>{
    return {
      data: `${el.data.split('/')[1]}/${el.data.split('/')[2]}`,
      valor: +el.valor
    }
  })
  }

  public async getPatrimonyEvolution(ctx: HttpContextContract) {

    const type: 'month' | 'year' = ctx.params.type;

    if(type === 'month') {
      const movements: any = await Movement.query()
    .select('month_ref', 'year', 'type_operation')
    .select(Database.raw('round(sum(total), 2) as total'))
    .whereIn('type_operation', [1,3])
    .groupBy('type_operation','month_ref', 'year')
    .preload('month')

     const mov = movements.filter((el: any) => el.type_operation === 1)
      return mov
    let sum = 0
    const chartMap = mov.map((el: any) =>{
      // const number = String(el.month_ref).padStart(2, '0');

      if(el.type_operation === 1)
        sum = sum + el.total
      // else if(el.type_operation === 3) {
      //   sum = el.total
      // }
      return {
        month_num: `${el.month.num}/${el.year}`,
        total_fees: sum,
        total: el.total,
        type: el.type_operation
      }
    })
    chartMap.sort((a, b) => {
      const [monthA, yearA] = a.month_num.split('/');
      const [monthB, yearB] = b.month_num.split('/');
      return yearB - yearA || monthB - monthA
    });

    // let result: any = []

    // chartMap.reduce((res, value) => {
    //   if (!res[value.month_num]) {
    //     res[value.month_num] = { month_num: value.month_num, total: 0 };
    //     result.push(res[value.month_num])
    //   }
    //   res[value.month_num].total += value.total;
    //   return res;
    // }, {});
      //   const summedData = chartMap.reduce((acc, item) => {
      //     const existingItem = acc.find((x) => x.month_num === item.month_num);

      //     if (existingItem) {
      //         existingItem.total += item.total;
      //         existingItem.total_fees += item.total_fees;
      //     } else {
      //         acc.push({ ...item });
      //     }

      //     return acc;
      // }, []);

    return chartMap
      // const investmetControl = new InvestmentsWalletsController()
      // const myApports: any = await investmetControl.aportsHistory('desc')
      // const myApports: any = await investmetControl.patrimonyGainList('desc')
      // let sum = 0
      // const aportsIncremet = myApports.map(({total_fees, month}: any) => {
      //   sum = sum + total_fees
      //   return {
      //     month,
      //     total: +sum.toFixed(2)
      //   }
      // });
    //   const valoresTrimestrais = dados.reduce((acc, dado) => {
    //     const [mes, ano] = dado.month.split('/');
    //     const trimestre = Math.ceil(parseInt(mes) / 3); // Calcula o trimestre
    //     const chave = `Q${trimestre}/${ano}`; // Cria uma chave trimestral

    //     if (!acc[chave]) {
    //         acc[chave] = 0;
    //     }

    //     acc[chave] += dado.total;

    //     return acc;
    // }, {});

    // return aportsIncremet
    }

  }
}
