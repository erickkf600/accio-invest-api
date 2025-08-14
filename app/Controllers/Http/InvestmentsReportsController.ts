import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import Database from '@ioc:Adonis/Lucid/Database';
import Movement from 'App/Models/Movement';
/**
 * NESSE CONTROLLER CONTEM OS ITENS DE RELATÓRIO
 * [His de preço médio, His de aports, His de dividendos, His de vendas]
 */

export default class InvestmentsReportsController {


  public async pmHistory(ctx: HttpContextContract) {
    const body: any = ctx.request.body()

    const movements: any = await Movement.query()
    .select('month_ref', 'year', 'cod', 'date_operation')
    .select(Database.raw('group_concat(date_operation) as date_operation'))
    .select(Database.raw('group_concat(unity_value) as unity_value'))
    .select(Database.raw('group_concat(qtd) as qtd'))
    .select(Database.raw('group_concat(month_ref) as month_ref'))
    .select(Database.raw('group_concat(year) as year'))
    .where('type_operation', 1)
    .where((query) => {
        if (body.cod) {
            query.where('cod', body.cod);
        }
    })
    .where((builder) => {
        if (body.period && body.period.length === 2) {
            const [startM, startY] = body.period[0].split('-').map(Number);
            const [endM, endY] = body.period[1].split('-').map(Number);

            const startDate = startY * 100 + startM; // Ex: 202303 para março de 2023
            const endDate = endY * 100 + endM; // Ex: 202309 para setembro de 2023

            builder.whereRaw(`
              (year * 100 + month_ref) BETWEEN ? AND ?
            `, [startDate, endDate]);
        }
    })
    .groupBy('cod')
    .orderBy('year', 'asc')

    const transformedData = movements.map(item => {
      const orderedData = item.month_ref.split(',').map((m, i) => ({
        month: m.padStart(2, '0'),
        year: item.year.split(',')[i],
        unity_value: item.unity_value.split(',')[i],
        qtd: item.qtd.split(',')[i],
        date_operation: item.date_operation.split(',')[i]
    }));

    orderedData.sort((a, b) => {
        const [dayA, monthA, yearA] = a.date_operation.split('/').map(Number);
        const [dayB, monthB, yearB] = b.date_operation.split('/').map(Number);
        const dateA = yearA * 10000 + monthA * 100 + dayA;
        const dateB = yearB * 10000 + monthB * 100 + dayB;
        return dateA - dateB;
    });

     const months = orderedData.map(d => d.month);
     const years = orderedData.map(d => d.year);
     const unitValues = orderedData.map(d => d.unity_value);
     const quantities = orderedData.map(d => d.qtd);

      let accumulatedQtd = 0;
      let accumulatedValue = 0;

      const pms = months.map((m, i) => {
        accumulatedValue += +unitValues[i] * +quantities[i] //acumulativo com o valor anterior
        accumulatedQtd += +quantities[i] //acumulativo com o valor anterior
        const mediumPrice = accumulatedValue/accumulatedQtd
        return {
          total_invest: parseFloat(accumulatedValue.toFixed(2)),
          total_quotas: accumulatedQtd,
          medium_price: parseFloat(mediumPrice.toFixed(2)),
          date: `${m.padStart(2, '0')}-${years[i]}`
        }
      })

      return {
        cod: item.cod,
        pms: pms
      }
    });


    return transformedData
  }

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
}
