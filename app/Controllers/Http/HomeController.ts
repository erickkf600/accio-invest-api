import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Database from '@ioc:Adonis/Lucid/Database'
import Asset from 'App/Models/Asset'
import Movement from 'App/Models/Movement'
import TickerRequests from 'App/services/ticker-requests.service'
import axios from 'axios'
import { groupBy, map, mapValues, sumBy } from 'lodash'
import InvestmentsWalletsController from './InvestmentsWalletsController'

export default class HomeController {

  private ticker = new TickerRequests()
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
    const userId = 1
    const assets: any = await Asset.query()
    .where('user_id', userId)
    .andWhere('quantity', '>', 0)
    .select('id', 'total', 'cod', 'quantity', 'total_rendi', 'type')
    .preload('assetsType')

    if(!assets.length) {
      return {
        "resume": {
            "total": 0,
            "last": 0,
            "last_dividend": 0,
            "startYear": 0,
            "patrimony": 0
        },
        "alocations": [],
        "distribuition": []
      }
    }

    let movements: any = await Movement.query()
    .select('id', 'total', 'fee', 'month_ref', 'unity_value', 'cod', 'date_operation', 'qtd', 'type_operation', 'type', 'year')
    .orderBy('year', 'desc')
    .orderBy('month_ref', 'desc')
    .whereIn('type_operation', [1,3,5])
    movements = movements.map(m => m.toJSON());

    const total = assets.reduce((acc: any, {total}: any) => acc+Number(total), 0)
    const last = this.lastByMonth(movements, 1)
    const last_dividend = this.lastByMonth(movements, 3)
    const startYear = last[last.length - 1].monthYear.split('/')[1]

    const patrimony = await this.createPatrimony(assets.map(el => ({cod: el.cod, qtd: el.quantity})))
    const alocations = this.getAlocations(assets)

    const distribuition = assets.map((el) => ({
      title: el.cod,
      qtd: el.quantity,
      hex: this.hexGenerator()
    }))

    return {
      resume: {
        total,
        last: last[0].total,
        last_dividend: last_dividend[0].total,
        startYear: +startYear,
        patrimony
      },
      alocations,
      distribuition
    }
  }

  private lastByMonth(content, type_operation: 1 | 3){
    const purchase = content.filter(m => m.type_operation === type_operation);

    // Agrupa pelo mês/ano (MM/YYYY)
    const grouped = groupBy(purchase, m => {
      const [_, month, year] = m.date_operation.split('/');
      return `${month}/${year}`; // chave: "MM/YYYY"
    });

    const totalsByMonth = Object.entries(grouped).map(([monthYear, items]) => {
      const total = sumBy(items, i => parseFloat(i.total));
      return {
        monthYear,
        total
      };
    });

    return totalsByMonth
  }

  private async createPatrimony(tickers: {cod: string, qtd: number}[]){
    const query = tickers.map((el: any) => el.cod).join('-')
    const tickerPricing = await this.ticker.accioTickerDataRequest(query)

    let totalPatrimony = 0;

    tickers.forEach(tickerItem => {
      // Encontra o preço atual correspondente
      const pricing = tickerPricing.find(p => p.ticker === tickerItem.cod);
      if (pricing) {
        totalPatrimony += pricing.curPrc * tickerItem.qtd;
      }
    });
    return totalPatrimony
  }

  private getAlocations(assets: any[]){
    const grouped = groupBy(assets, "type");

    // Calcula a soma do total em cada grupo
    return map(grouped, (items) => ({
      type: items[0].assetsType.title,
      qtd: sumBy(items, (item) => item.quantity),
      total: sumBy(items, (item) => parseFloat(item.total)),
      hex: this.hexGenerator()
    }));
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
  const myReturns: any = await investmetControl.patrimonyGainList()
  const returnByYear = myReturns.filter((item) => Number(`20${item.month.split('/')[1]}`) == year)
  const newValue = [...Array(12)].map((_, i: number) =>{
    const mes = String(i + 1).padStart(2, '0');
    const val = {
      data: `${mes}/${year.slice(2)}`,
      preco_compra: null,
      preco_medio: null
    }
    const founded = returnByYear.find(e =>  e.month == val.data)
    if(founded) {
      val.preco_compra = +founded?.rentability.replace('%', '') as any || null
      val.preco_medio = +founded?.rentability_medium_price.replace('%', '') as any || null
    }
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


  public async getPatrimonyEvolution(ctx: HttpContextContract) {

    const type: 'month' | 'year' = ctx.params.type;
    // const page: number = ctx.params.page;
    // const limit: number = ctx.params.limit;

    if(type === 'year') {
      let movements: any = await Movement.query()
      .select('year')
      .select(Database.raw('round(sum(total), 2) as total'))
      .whereIn('type_operation', [1,3,5])
      .orderBy('year', 'asc')
      .groupBy('year')
      movements = movements.map(m => m.toJSON());
      let sum = 0;
      const evolutionCalc = movements.map(d => ({
        label: d.year,
        total: (sum += parseFloat(d.total)).toFixed(2)
      }));

      // paginação
      // const paginatedData = evolutionCalc.slice((page - 1) * limit, page * limit);

      return  evolutionCalc
    } else  {
      const movements: any = await Movement.query()
      .select('month_ref', 'year', 'type_operation')
      .select(Database.raw('round(sum(total), 2) as total'))
      .whereIn('type_operation', [1,3,5])
      .groupBy('type_operation','month_ref', 'year')
      .preload('month')
      .orderBy('year', 'asc')
      .orderBy('month_ref', 'asc')

      const groupedData = groupBy(movements, item => `${item.month_ref}-${item.year}`);

      const result = map(groupedData, (group, key) => {
        const [_, year] = key.split('-').map(Number);
        const firstItem = group[0];
        const monthAbbrev = firstItem.month.title.toLowerCase().slice(0, 3); // "Nov" → "nov"
        const formattedMonth = `${monthAbbrev}/${year.toString().slice(-2)}`; // "nov/22"
        return {
          total: sumBy(group, item => parseFloat(item.total)).toFixed(2),
          label: formattedMonth,
        };
      });

      let sum = 0;
      const evolutionCalc = result.map(d => ({
        ...d,
        total: (sum += parseFloat(d.total)).toFixed(2)
      }));

      // const paginatedData = evolutionCalc.slice((page - 1) * limit, page * limit);
      // const quarterly = evolutionCalc.filter((_, index) => index % 3 === 0);

      return  evolutionCalc
    }
  }

  async quarterlyData(){
    const quarterly: any = await Movement.query()
      .select('month_ref', 'year', 'type_operation')
      .select(Database.raw('round(sum(total), 2) as total'))
      .whereIn('type_operation', [1,3,5])
      .groupBy('type_operation','month_ref', 'year')
      .preload('month')
      .orderBy('year', 'asc')
      .orderBy('month_ref', 'asc')

      const groupedData = groupBy(quarterly, item => `${item.month_ref}-${item.year}`);

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

      let sum = 0;
      const evolutionCalc = result.map(d => ({
        ...d,
        total: (sum += parseFloat(d.total)).toFixed(2)
      }));

      // filtra para exbir trimestralmente
      const filteredData = evolutionCalc.filter((_, index) => index % 3 === 0);


      return filteredData

  }
}
