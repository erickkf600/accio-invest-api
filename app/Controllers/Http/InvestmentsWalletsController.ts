import Env from '@ioc:Adonis/Core/Env';
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import Database from '@ioc:Adonis/Lucid/Database';
import Asset from 'App/Models/Asset';
import Movement from 'App/Models/Movement';
import AccumulativeCalc from 'App/services/accumulative-calc';
import TickerRequests from 'App/services/ticker-requests.service';
import axios from 'axios';
import { groupBy, keyBy, map, orderBy, sumBy, uniqBy } from 'lodash';

export default class InvestmentsWalletsController {
  private ticker = new TickerRequests()
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

public async resume(){
  const userId = 1
    const assets: any = await Asset.query()
    .where('user_id', userId)
    .andWhere('quantity', '>', 0)
    .select('cod', 'quantity', 'total_rendi', 'medium_price', 'type', 'total', 'total_fee')
    .preload('assetsType')

    if(!assets.length) return []

    const patrimony = await this.createPatrimony(assets.map(el => ({cod: el.cod, qtd: el.quantity})))

    const totals = assets.reduce((acc, item) => {
      acc.total_medium += parseFloat(item.medium_price) || 0;
      acc.total_provents += parseFloat(item.total_rendi) || 0;
      return acc;
    }, { total_medium: 0, total_provents: 0 });


  return {patrimony, ...totals}
}

  public async compositionList(){
    const userId = 1
    const assets: any = await Asset.query()
    .where('user_id', userId)
    .andWhere('quantity', '>', 0)
    .select('cod', 'quantity', 'total_rendi', 'medium_price', 'type', 'total', 'total_fee')
    .preload('assetsType')
    if(!assets.length) return []

    const dividends: any = await Movement.query()
    .select('id', 'cod', 'type', 'qtd', 'total', 'date_operation')
    .whereIn('type_operation', [3,5])
    .where('user_id', userId)
    if(!assets.length) return []

    const grouped = groupBy(assets, 'type');

  const now = new Date();
  const lastYear = new Date();
  lastYear.setFullYear(now.getFullYear() - 1);
  const last30Days = new Date();
  last30Days.setDate(now.getDate() - 30);

  let result = map(grouped, (items) => {
    const qtd = sumBy(items, 'quantity');
    const total = sumBy(items, (i) => parseFloat(i.total));
    const total_rent = sumBy(items, (i) => parseFloat(i.total_rendi));

    const codes = items.map(i => i.cod);
    const dividendsGroup = dividends.filter(d => codes.includes(d.cod));

    // Rendimento últimos 30 dias
    const rentMonth = sumBy(dividendsGroup, (d: any) => {
      const [day, month, year] = d.date_operation.split('/').map(Number);
      const divDate = new Date(year, month - 1, day);
      return divDate >= last30Days && divDate <= now ? parseFloat(d.total) : 0;
    });

    // Rendimento últimos 12 meses
    const rentLast12 = sumBy(dividendsGroup, (d: any) => {
      const [day, month, year] = d.date_operation.split('/').map(Number);
      const divDate = new Date(year, month - 1, day);
      return divDate >= lastYear && divDate <= now ? parseFloat(d.total) : 0;
    });

    return {
      type: items[0].assetsType.title,
      qtd,
      total,
      current_value: total, // valor atual placeholder
      percent_wallet: '0%', // será calculado depois
      total_rent: total > 0 ? `${((total_rent / total) * 100).toFixed(2)}%` : '0%',
      rent_last_12: total > 0 ? `${((rentLast12 / total) * 100).toFixed(2)}%` : '0%',
      rent_month: total > 0 ? `${((rentMonth / total) * 100).toFixed(2)}%` : '0%',
      hex: this.hexGenerator()
    };
  });

  const totalPatrimony = sumBy(result, 'total');
  result = result.map(item => ({
    ...item,
    percent_wallet: totalPatrimony > 0 ? `${((item.total / totalPatrimony) * 100).toFixed(0)}%` : '0%'
  }));

  return result;
  }
  public async assetsList() {
    const userId = 1;
    const assets: any = await Asset.query()
  .where('user_id', userId)
  .andWhere('quantity', '>', 0)
  .select('id', 'cod', 'quantity', 'total_rendi', 'medium_price', 'type', 'total', 'total_fee')
  .preload('assetsType');
  if(!assets.length) return []

  const dividends: any = await Movement.query()
  .select('id', 'cod', 'type', 'qtd', 'total', 'date_operation')
  .whereIn('type_operation', [3,5])
  .where('user_id', userId);

  const query = assets.map((el: any) => el.cod).join('-')
  const tickerPricing = await this.ticker.accioTickerDataRequest(query)

  // datas de corte
  const now = new Date();
  const lastYear = new Date();
  lastYear.setFullYear(now.getFullYear() - 1);
  const last30Days = new Date();
  last30Days.setDate(now.getDate() - 30);



  const response = assets.map((asset: any) => {
    const assetDividends = dividends.filter(d => d.cod === asset.cod);

    // rendimento últimos 30 dias
    const rentMonth = sumBy(assetDividends, (d: any) => {
      const [day, month, year] = d.date_operation.split('/').map(Number);
      const divDate = new Date(year, month - 1, day);
      return divDate >= last30Days && divDate <= now ? parseFloat(d.total) : 0;
    });

    // rendimento últimos 12 meses
    const rentLast12 = sumBy(assetDividends, (d: any) => {
      const [day, month, year] = d.date_operation.split('/').map(Number);
      const divDate = new Date(year, month - 1, day);
      return divDate >= lastYear && divDate <= now ? parseFloat(d.total) : 0;
    });

    const b3 = tickerPricing.find((ser: any) => ser.ticker === asset.cod)

    return {
      cod: asset.cod,
      asset_id: asset.id,
      qtd: asset.quantity,
      type: asset.assetsType.title,
      type_id: asset.assetsType.id,
      curr_price: b3.curPrc,
      payed_dividend: asset.total_rendi,
      total: +asset.total,
      price_total: +asset.quantity * b3.curPrc,
      patrimony: (+asset.quantity * b3.curPrc) + +asset.total_rendi,
      medium_price: parseFloat(asset.medium_price).toFixed(3),
      rent_last_12: asset.total > 0 ? `${((rentLast12 / asset.total) * 100).toFixed(2)}%` : '0%',
      rent_month: asset.total > 0 ? `${((rentMonth / asset.total) * 100).toFixed(2)}%` : '0%',
    };
  });

  return response;

}


  public async rentability(ctx: HttpContextContract){
    const userId = 1
    const year: number = ctx.params.year;

    let assets: any = await Asset.query()
    .where('user_id', userId)
    .andWhere('quantity', '>', 0)
    .select('cod', 'quantity', 'total_rendi', 'medium_price', 'type', 'total', 'total_fee', 'created_at')
    .preload('assetsType')

    assets = assets.map(m => m.toJSON());


    if (!assets.length) return []

    const movements = await Movement.query()
    .select('cod', 'month_ref', 'year', 'type', 'type_operation', 'total', 'rentability', 'qtd', 'fee', 'date_operation')
    .orderBy('date_operation', 'asc')
    .whereIn('type_operation', [1,2,3,5])
    .where('user_id', userId)
    .preload('assetsType')
    .preload('typeOperation')

    const startYear = Math.min(
      ...movements
        .filter(el => el.type_operation === 3 || el.type_operation === 5)
        .map(item => item.year)
    );
    const grouped = groupBy(assets, 'type');

    const composition = map(grouped, (items) => ({
      type: items[0].assetsType.title,
      total: sumBy(items, (item) => parseFloat(item.total_rendi)),
      hex: this.hexGenerator()
    }))

    const start = new Date(year, 0, 1).toISOString().split("T")[0];
    const end = new Date(year, 11, 31).toISOString().split("T")[0];

    const payload = {
      dataInicio: start,
      dataFim: end,
      papeis_tipos: assets.map((el: any) => ({ papel: el.cod, tipo: el.type }))
    }

    const historyEarnings = await this.ticker.accioTickerEarningsRequest(payload)

    const flattened = historyEarnings.flatMap(item =>
      item.proventos.map(p => {
        const mov = movements.find(el => el.cod === item.ticker && el.type_operation === 3);
        return {
          payment_date: p.payment_date,
          cod: item.ticker,
          percent: p.percent,
          value: p.value,
          date_com: p.date_com,
          month_ref:  +p.payment_date.split('/')[1],
          year:  +p.payment_date.split('/')[2],
          type: movements.find(el => el.cod === item.ticker)?.assetsType,
          typeOperation: mov?.typeOperation || { id: 3, title: 'Dividendos' }
        }
      })
    );

    const rentalDividends = movements
    .filter(m => m.type_operation === 5)
    .map(m => ({
      payment_date: m.date_operation,
      cod: m.cod,
      percent: null,
      value: m.rentability ?? m.total,
      date_com: m.date_operation,
      month_ref: m.month_ref,
      year: m.year,
      type: m.assetsType,
      typeOperation: m.typeOperation
    }));

    const allDividends = [...flattened, ...rentalDividends];

    // função para calcular quantidade em carteira até uma data
    function getQuantityAtDate(movements: Movement[], cod: string, dateCom: string): number {
      const [day, month, year] = dateCom.split("/").map(Number);
      const dateComParsed = new Date(year, month - 1, day);

      return movements
        .filter(m => m.cod === cod)
        .filter(m => {
          const [d, mth, y] = m.date_operation.split("/").map(Number);
          const movDate = new Date(y, mth - 1, d);
          return movDate <= dateComParsed;
        })
        .reduce((acc, m) => {
          if (m.type_operation === 1) { // compra
            return acc + m.qtd;
          } else if (m.type_operation === 2) { // venda
            return acc - m.qtd;
          }
          return acc;
        }, 0);
    }

    const enriched = allDividends.map(item => {
      const [day, month, year] = item.payment_date.split("/").map(Number);
      const paymentDate = new Date(year, month - 1, day);

      const qtdAtDate = getQuantityAtDate(movements, item.cod, item.date_com);
      let totalReceived = qtdAtDate * item.value;
      if(!item?.percent||item.percent === '0.00') {
        const mediumPrice = assets.find(el => el.cod === item.cod)?.medium_price
        if(mediumPrice) {
          item.percent = item.value / Number(mediumPrice) * 100
        }
      }
      // checa se já tem registro no banco
      const alreadyRegistered = movements.some(m => {
        if (m.cod !== item.cod) return false;

        const [d, mth, y] = m.date_operation.split("/").map(Number);
        const movDate = new Date(y, mth - 1, d);

        return (
          movDate.getTime() === paymentDate.getTime() &&
          (m.type_operation === 3 || m.type_operation === 5)// supondo que 3  ou 5 = dividendos
        );
      });
      let status = alreadyRegistered ? "registered" : "not_registered";

      if (item.typeOperation?.id === 5 || item.typeOperation?.code === 5) {
        status = "rent";
        totalReceived = +item.value
      }

      return {
        ...item,
        qtdAtDate,
        totalReceived,
        status: status
      };
    });

    return { startYear, composition, earnings: enriched }
  }
  public async dividendsList(ctx: HttpContextContract) {
    const {start, end}: any = ctx.request.qs();
    const userId = 1
    let assets: any = await Asset.query()
    .where('user_id', userId)
    .andWhere('quantity', '>', 0)
    .select('cod', 'quantity', 'total_rendi', 'medium_price', 'type', 'total', 'total_fee', 'created_at')
    .preload('assetsType')

    assets = assets.map(m => m.toJSON());

    if (!assets.length) return []

    const movements = await Movement.query()
    .select('cod', 'month_ref', 'year', 'type', 'type_operation', 'total', 'rentability', 'qtd', 'fee', 'date_operation')
    .orderBy('date_operation', 'asc')
    .whereIn('type_operation', [1,2])
    .where('user_id', userId)
    .preload('assetsType')
    .preload('typeOperation')

    const payload = {
      dataInicio: start,
      dataFim: end,
      papeis_tipos: assets.map((el: any) => ({ papel: el.cod, tipo: el.type }))
    }

    const historyEarnings = await this.ticker.accioTickerEarningsRequest(payload)

    const flattened = historyEarnings.flatMap(item =>
      item.proventos.map(p => {
        return {
          payment_date: p.payment_date,
          cod: item.ticker,
          value: p.value,
          date_com: p.date_com,
          type: assets.find(el => el.cod === item.ticker)?.assetsType.id,
          type_operation: 3,
        }
      })
    );

    // função para calcular quantidade em carteira até uma data
    function getQuantityAtDate(movements: Movement[], cod: string, dateCom: string): number {
      const [day, month, year] = dateCom.split("/").map(Number);
      const dateComParsed = new Date(year, month - 1, day);

      return movements
        .filter(m => m.cod === cod)
        .filter(m => {
          const [d, mth, y] = m.date_operation.split("/").map(Number);
          const movDate = new Date(y, mth - 1, d);
          return movDate <= dateComParsed;
        })
        .reduce((acc, m) => {
          if (m.type_operation === 1) { // compra
            return acc + m.qtd;
          } else if (m.type_operation === 2) { // venda
            return acc - m.qtd;
          }
          return acc;
        }, 0);
    }

    const enriched = flattened.map(item => {
      const qtdAtDate = getQuantityAtDate(movements, item.cod, item.date_com);
      return  {
        ...item,
        qtdAtDate
      }
    }).filter(el => el.qtdAtDate > 0)

    return enriched
  }

  public async patrimonyGainList(order: 'asc' | 'desc' = 'asc') {
    const userId = 1

    const movements = await Movement.query()
    .select('cod', 'month_ref', 'year', 'type_operation', 'total', 'rentability', 'qtd', 'fee')
    .orderBy('year', 'asc')
    .orderBy('month_ref', 'asc')
    .whereIn('type_operation', [1,3,5])
    .andWhere('user_id', userId)

    const grouped = groupBy(movements, item => `${item.month_ref}-${item.year}-${item.type_operation}`);

    const resultGrouped = map(grouped, (items, key) => {
      const [month_ref, year, type_operation] = key.split("-").map(Number);
      const total = items.reduce((sum, i: any) => sum + parseFloat(i.total), 0);
      return {
        month_ref,
        year,
        type_operation,
        total: total.toFixed(2),
        qtd: items.reduce((acc, i) => acc + Number(i.qtd), 0),
        fee: items.reduce((acc, i) => acc + Number(i.fee), 0)
      };
    });
    const purchase = resultGrouped.filter((p) => p.type_operation === 1)

    const dividends = resultGrouped.filter((p) => p.type_operation === 3 || p.type_operation === 5)

    const accumulated = await this.accumulationCacl.someTotais(purchase.map(el => el.total))
    const accumulatedQtd = await this.accumulationCacl.someTotais(purchase.map(el => el.qtd))
    const accumulatedFee = await this.accumulationCacl.someTotais(purchase.map(el => el.fee))
    const aportsIncrement = purchase.map(({year, month_ref}: any, i: number) => {
      return {
        year,
        month_ref,
        total: accumulated[i],
        qtd: +accumulatedQtd[i],
        fee: +accumulatedFee[i]
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
      const totalNoFee = aportTotal - a.fee
      const rentability = aportTotal > 0 ? (dividendTotal / aportTotal) * 100 : 0;
      const mediumPrice = a.qtd > 0 ? totalNoFee / a.qtd: 0;
      const rentabilityMedium = mediumPrice > 0 ? (dividendTotal / (mediumPrice * a.qtd)) * 100 : 0;
      const month = `${String(a.month_ref).padStart(2, "0")}/${String(a.year).slice(-2)}`;
      return {
        qtd: a.qtd,
        fee: a.fee,
        month,
        dividend_total: dividendTotal.toFixed(2),
        total: a.total,
        total_medium_price: mediumPrice.toFixed(2),
        rentability: rentability.toFixed(3) + "%",
        rentability_medium_price: rentabilityMedium.toFixed(3) + "%",
      };
    });

    const orderedResult = orderBy(result, r => {
      const [m, y] = r.month.split("/");   // ex: "09/22" => ["09","22"]
      return y + m;                        // "22" + "09" = "2209"
    }, [order]);


    return  orderedResult
  }

  public async VariationsList() {
    const userId = 1
    const asset: any = await Asset.query()
    .select('cod', 'quantity', 'total_rendi', 'medium_price', 'type', 'total', 'total_fee')
    .where('quantity', '>', 0)
    .andWhere('user_id', userId)
    .preload('assetsType')

    const query = asset.map((el: any) => el.cod).join('-')
    const tickerPricing = await this.ticker.accioTickerDataRequest(query)

    const result = asset.map((el: any, i: number) => {
      const curr_price = tickerPricing[i].curPrc || 0
      const patrimony = curr_price * el.quantity
      const medium = parseFloat(el.medium_price) || 0;

      let rent = 0;
      let status = '-';

      if (curr_price > 0 && medium > 0) {
        rent = ((curr_price - medium) / medium) * 100;
        status = rent >= 0 ? '+' : '-';
      }
      if (curr_price === 0) {
        rent = -100;
        status = '-';
      }
      const rentability = Number(rent.toFixed(2))
      return {
        cod: el.cod,
        qtd: el.quantity,
        curr_price,
        total_invest: +el.total,
        current_patrimony: patrimony > 0 ? parseFloat(patrimony.toFixed(3) + +el.total_rendi) : +el.total,
        total_patrimony: parseFloat(patrimony.toFixed(3)) || +el.total + +el.total_rendi,
        medium_price: medium,
        percent: `${rentability}%`,
        ralation: status,
        type: el.assetsType.title

      }
    })
    return result
  }

  public async DividendsGraph(ctx: HttpContextContract) {
    const userId = 1
    const year: number = ctx.params.year;
    const dividendsCurrent: any = await Movement.query()
    .select('cod', 'date_operation', 'qtd', 'unity_value', 'type', 'year', 'month_ref', 'type_operation')
    .select(Database.raw('round(sum(total), 2) as total'))
    .whereIn('type_operation', [3,5])
    .andWhere('user_id', userId)
    .groupBy('year', 'month_ref')
    .preload('assetsType')
    .preload('month')

    const startYear = Math.min(...dividendsCurrent.map(item => item.year));

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
    return {startYear: startYear, content: [responseLastYear, responseCurrentYear]}
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
    const userId = 1
    const movements: any = await Movement.query()
    .select('id', 'cod', 'type', 'qtd', 'total')
    .groupBy('cod')
    .select(Database.raw('round(sum(total), 2) as total'))
    .where('type_operation', 1)
    .andWhere('user_id', userId)
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

  private hexGenerator = () => {
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
  }

}
