import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Movement from 'App/Models/Movement'
import Database from '@ioc:Adonis/Lucid/Database'
import axios from 'axios'


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
  public async showHome(_ctx: HttpContextContract) {
    const movements: any = await Movement.query()
    .select('id', 'total', 'fee', 'month_ref', 'unity_value', 'cod', 'date_operation', 'qtd', 'type_operation', 'type')
    .orderBy('year', 'desc')
    .orderBy('month_ref', 'desc')
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

    const resume = await this.resume(movements)

    const alocations = await this.removeDupliWithSum(movements, 1, 'type');
    const distribuition = await this.distribuition(movements)
    const aports = await this.AportsGraph()
    return {resume, alocations, distribuition, aports}
  }


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
}
