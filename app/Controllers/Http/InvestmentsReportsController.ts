import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import Database from '@ioc:Adonis/Lucid/Database';
import BrokerageInvoices from 'App/Models/BrokerageInvoices';
import FixedIncome from 'App/Models/FixedIncome';
import Movement from 'App/Models/Movement';
import Unfolding from 'App/Models/Unfolding';
import FileBrowser from 'App/services/filebrowser.service';
import { groupBy, map, maxBy, minBy, sumBy } from 'lodash';
import { DateTime } from 'luxon';


export default class InvestmentsReportsController {

  // paperless = new Paperless()
  fileBrowser = new FileBrowser()
  public async aportsHistory(order: string = 'asc') {
    const movements: any = await Movement.query()
    .select('month_ref', 'year')
    .select(Database.raw('group_concat(cod) as cod'))
    .select(Database.raw('group_concat(unity_value) as unity_value'))
    .select(Database.raw('group_concat(qtd) as qtd'))
    .select(Database.raw('group_concat(fee) as fee'))
    .select(Database.raw('round(sum(total), 2) as total'))
    .where( 'type_operation', 1)
    .groupBy('year','month_ref')
    .orderBy('year', 'asc')
    .orderBy('month_ref', 'asc')
    .preload('month')


    const chartMap = movements.map((el: any) =>{
      // const number = String(el.month_ref).padStart(2, '0');
      let sum = 0
      const cods = el.cod.split(',')
      const vals = el.unity_value.split(',')
      const qtds = el.qtd.split(',')
      const fees = el.fee.split(',')
      const setItem = cods.map((cd: any, i: number) =>{
        sum += +fees[i]

        return {
          asset: cd,
          value: +vals[i] * +qtds[i],
          qtd: +qtds[i],
          fee: +fees[i]
        }
      })
      return {
        value: setItem.reduce((acc, {value}) => acc+value ,0),
        month: `${el.month.title}/${el.year}`,
        month_num: el.month.num,
        items: setItem,
        total_fees: el.total,
        fees: sum
      }
    })
    chartMap.sort((a, b) => {
      const [, yearA] = a.month.split('/');
      const [, yearB] = b.month.split('/');
      if(order === 'asc')
        return yearB - yearA || b.month_num - a.month_num;
      if(order === 'desc')
        return yearA - yearB || a.month_num - b.month_num;
  });
    return chartMap
  }

  public async rentHistory(_ctx: HttpContextContract) {
    const userId = 1
    const movements: any = await Movement.query()
    .select('id', 'cod', 'date_operation', 'type_operation', 'total', 'obs', 'type')
    .where('type_operation', 5)
    .andWhere('user_id', userId)
    .preload('assetsType', (query) =>{
      query.select('title', 'full_title')
    })
    return movements
  }

  public async sellHistory(_ctx: HttpContextContract) {
    const userId = 1
    const movements: any = await Movement.query()
    .select('id', 'cod', 'date_operation', 'type_operation', 'total', 'obs', 'type')
    .where('type_operation', 2)
    .andWhere('user_id', userId)
    .preload('assetsType', (query) =>{
      query.select('title', 'full_title')
    })
    return movements
  }

  public async unfoldHistory(_ctx: HttpContextContract) {
    const userId = 1
    const unfolds: any = await Unfolding.query()
    .where('user_id', userId)
    .preload('change')
    return unfolds
  }

  public async pmHistory(ctx: HttpContextContract) {
    const body: any = ctx.request.body()

    const movements: any[] = await Movement.query()
    .select('cod', 'total', 'fee', 'date_operation', 'unity_value', 'qtd', 'type', 'type_operation', 'month_ref', 'year')
    .whereIn('type_operation', [1,2])
    .whereNot('type', 3)
    .where((query) => {
      if (body.cod) {
        query.where('cod', body.cod);
      }
    })
      .orderBy('cod', 'asc')
      .orderBy('date_operation', 'asc');

      if (!movements.length) return [];

    // Ajuste de período no JS
    let filtered = movements;
    if (body.period && body.period.length === 2) {
       const [startM, startY] = body.period[0].split('-').map(Number);
        const [endM, endY] = body.period[1].split('-').map(Number);

      let startDate = startY * 100 + startM;
      let endDate = endY * 100 + endM;

       // última data cadastrada
       const maxDate = maxBy(movements, m => m.year * 100 + m.month_ref);
       const minDate = minBy(movements, m => m.year * 100 + m.month_ref);
       if (maxDate && minDate) {
        const initDate = minDate.year * 100 + minDate.month_ref;
        const lastDate = maxDate.year * 100 + maxDate.month_ref;
        if (endDate > lastDate) {
          startDate = initDate;
          endDate = lastDate;
        }
       }
       filtered = movements.filter(m => {
        const currentDate = m.year * 100 + m.month_ref;
        return currentDate >= startDate && currentDate <= endDate;
      });
    }
    if (!filtered.length) return [];
    const grouped = groupBy(filtered, "cod");
    const content: any = map(grouped, (items: any, cod) => {
      const qtd = Math.max(
        sumBy(items, (item: any) => (item.type_operation === 1 ? item.qtd : -item.qtd)),
        0
      );
      const total = sumBy(items, (item: any) => Number(item.total) || 0);
      const fee = sumBy(items, (item: any) => Number(item.fee) || 0);
      return {
        cod,
        qtd,
        total,
        medium_price: +qtd > 0 ? parseFloat(((+total - +fee) / +qtd).toFixed(2)) : 0,
      }
    })

    return content.filter(el => !!el.qtd)
  }

  public async fixedIcomingHist(_ctx: HttpContextContract){
    const userId = 1
      const fixedIcome: any = await FixedIncome.query()
      .where('user_id', userId)
      .select('id', 'emissor', 'interest_rate', 'invest_type', 'title_type', 'date_operation', 'date_expiration', 'form', 'index', 'obs', 'total', 'daily_liquidity', 'other_cost', 'rentability', 'expired')

      return fixedIcome
  }

  public async uploadBrokerage(ctx: HttpContextContract) {
    // const file: any = ctx.request.file('notas_corretagem')
    const now = DateTime.local()
    const userId = 1
    try {
      const allFiles = ctx.request.allFiles()
      let path
      let fileItem
      let fileName
      for (const [fieldName, file] of Object.entries(allFiles)) {
        path = `${fieldName}/${(file as any).clientName}`
        fileName = (file as any).clientName
        fileItem = file
      }

      if(!this.fileBrowser.token) {
        await this.fileBrowser.auth()
      }
      const payload = {
        name: fileName,
        date_operation: now.toFormat('dd/MM/yyyy'),
        path: path,
        month_ref:  now.month,
        year: now.year,
        user_id: userId
      }
      await BrokerageInvoices.create(payload)
      await this.fileBrowser.upload(path, fileItem)
      return payload
    } catch (error) {
      throw {
        code: 4,
        message: `Ocorreu um erro ao cadastrar nota: ${error}`,
      };
    }
  }

  public async getInvoicesList(ctx: HttpContextContract) {
    const queryParam: any = ctx.request.qs().path;
    const userId = 1

    if(!queryParam) {
      return BrokerageInvoices.query()
      .select('id', 'name', 'date_operation', 'path')
      .where('user_id', userId)
    }else{
      if(!this.fileBrowser.token) {
        await this.fileBrowser.auth()
      }
      const files = this.fileBrowser.viewFile(queryParam)
      if(!files) return []
      return files
    }
  }

}
