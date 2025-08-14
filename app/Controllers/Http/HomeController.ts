import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Movement from 'App/Models/Movement'
import Database from '@ioc:Adonis/Lucid/Database'
import axios from 'axios'
import InvestmentsWalletsController from './InvestmentsWalletsController'
import { groupBy, map, orderBy, sumBy } from 'lodash'


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
      el.hex = this.hexGenerator()
      el.total = +el.total
      el.fee = +el.fee
      el.unity_value = +el.unity_value
    })

    if(!movements.length) return {resume: [], alocations: [], distribuition: [], aports: []}
    const resume = await this.resume(movements)
    const alocations = await this.removeDupliWithSum(movements, 1, 'type');
    const distribuition = await this.distribuition(movements)

    return {resume, alocations, distribuition}
  }

//TODO REVER COMO SE CALCULA O RENDIMENTO
  private async resume(array: any){
    const total = await this.sumValues(array)

    const groupArrays = await this.arrayGroup(array)
    const groupArraysDividends = this.arrayGroup(array, 3)
    const lastAport = groupArrays.reduce((acc: any, {total}: any) => acc + total, 0)
    const lastDividends = (groupArraysDividends.length ? groupArraysDividends : []).reduce((acc: any, {total}: any) => acc + total, 0) || 0

    const patrimony = await this.getPatrimony(array)

    const oldestDate = array
  .map(item => {
    const [month, year] = item.date_operation.split('/').map(Number);
    return new Date(year, month - 1);
  })
  .reduce((min, curr) => curr < min ? curr : min);

    const oldestYear = oldestDate.getFullYear();

    return {
      total: total,
      last: lastAport,
      last_dividend: lastDividends,
      startYear: oldestYear,
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

  public async AportsGraph(ctx: HttpContextContract) {
    // const year = new Date().getFullYear()
    const year: number = ctx.params.year;
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
    const maxDarkValue = 100; // tonalidade - 100 escuro >++
  const r = Math.floor(Math.random() * (maxDarkValue + 1))
    .toString(16)
    .padStart(2, '0');
  const g = Math.floor(Math.random() * (maxDarkValue + 1))
    .toString(16)
    .padStart(2, '0');
  const b = Math.floor(Math.random() * (maxDarkValue + 1))
    .toString(16)
    .padStart(2, '0');
  return `#${r}${g}${b}`;
    // const grayValue = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    // return `#${grayValue}${grayValue}${grayValue}`;
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

    val.data =  val.data.padStart(2, '0')
    return val
  })


  return newValue
}

  private async cdiData(year: number) {
    const cdiPercent = await this.cdiRequest(year)
    const fullYear = [...Array(12)].map((_, i: number) =>{
      return  {
        data: `${(i + 1).toString().padStart(2, '0')}/${year.toString().slice(2)}`,
      valor: +cdiPercent[i]?.valor || null
      }
    })
    return fullYear
  }


  // rever essa logica - se basear no Patrimônio x Ganho em que deve incrementar cada mes indicando a evolução e para o grafico deve ser a soma trimestral
  public async getPatrimonyEvolution(ctx: HttpContextContract) {

    const type: 'month' | 'year' = ctx.params.type;
    const page: number = ctx.params.page;
    const limit: number = ctx.params.limit;

    if(type === 'year') {
      const movements: any = await Movement.query()
      .select('year')
      .select(Database.raw('round(sum(total), 2) as total'))
      .where('type_operation', 1)
      .groupBy('year')
      .paginate(page, limit)
        return movements
    } else  {
      let movements: any = await Movement.query()
      .select('month_ref', 'year', 'type_operation')
      .select(Database.raw('round(sum(total), 2) as total'))
      .whereIn('type_operation', [1,3])
      .groupBy('type_operation','month_ref', 'year')
      .preload('month')
      .orderBy('year', 'asc')
      .orderBy('month_ref', 'asc')
      .paginate(page, limit)
      movements = movements.toJSON()

      const content = movements.data

      const groupedData = groupBy(content, item => `${item.month_ref}-${item.year}`);


      const result = map(groupedData, (group, key) => {
        const [_, year] = key.split('-').map(Number);
        const firstItem = group[0];
        const monthAbbrev = firstItem.month.title.toLowerCase().slice(0, 3); // "Nov" → "nov"
        const formattedMonth = `${monthAbbrev}/${year.toString().slice(-2)}`; // "nov/22"
        return {
          total: sumBy(group, item => parseFloat(item.total)).toFixed(2),
          month: formattedMonth,
        };
      });
      return {
        total: movements.meta.total,
        current_page: movements.meta.current_page,
        per_page: movements.meta.per_page,
        data: result
      }
    }

  }

  async quarterlyData(){

    const quarterly: any = await Movement.query()
    .select('year', "month_ref")
    .select(Database.raw('CEIL(month_ref/3) as quarter')) // Trimestre (1-4)
    .select(Database.raw('MIN(month_ref) as first_month')) // Primeiro mês do trimestre
    .select(Database.raw('MAX(month_ref) as last_month'))  // Último mês do trimestre
    .select(Database.raw('round(sum(total), 2) as total'))
    .whereIn('type_operation', [1, 3])
    .groupBy('year', 'quarter') // Agrupa por ano e trimestre
    .orderBy('year', 'asc')
    .orderBy('quarter', 'asc');

      return quarterly

    // const quarterly: any = await Movement.query()
    //   .select('month_ref', 'year', 'type_operation')
    //   .select(Database.raw('round(sum(total), 2) as total'))
    //   .whereIn('type_operation', [1,3])
    //   .groupBy('type_operation','month_ref', 'year')
    //   .preload('month')
    //   .orderBy('year', 'asc')
    //   .orderBy('month_ref', 'asc')

    //   const getQuarter = (month) => Math.ceil(month / 3);

    //   // Processar os dados para agrupar por trimestre
    //   const groupedByQuarter = quarterly.reduce((acc, movement) => {
    //     const quarter = getQuarter(movement.month_ref);
    //     const key = `${movement.year}-T${quarter}`;

    //     if (!acc[key]) {
    //       acc[key] = {
    //         year: movement.year,
    //         quarter: quarter,
    //         start_month: movement.month_ref - ((movement.month_ref - 1) % 3),
    //         end_month: movement.month_ref + (2 - ((movement.month_ref - 1) % 3)),
    //         operations: {},
    //         months: []
    //       };
    //     }

    //     // Agrupar por type_operation
    //     if (!acc[key].operations[movement.type_operation]) {
    //       acc[key].operations[movement.type_operation] = 0;
    //     }
    //     acc[key].operations[movement.type_operation] += parseFloat(movement.total);

    //     // Manter informações dos meses individuais
    //     acc[key].months.push(movement);

    //     return acc;
    //   }, {});

    //   const result = Object.values(groupedByQuarter).map((quarter: any) => {
    //     return  quarter.months.map((el: any) =>{
    //       const monthAbbrev = el.month.title.toLowerCase().slice(0, 3); // "Nov" → "nov"
    //       const formattedMonth = `${monthAbbrev}/${el.year.toString().slice(-2)}`; // "nov/22"
    //       return {
    //         label: formattedMonth,
    //         value: el.total
    //       }
    //     })
    //     return {
    //       value: quarter.months.total,
    //       label: quarter.months

    //     }
    //   });

    //   return result

  }
}
