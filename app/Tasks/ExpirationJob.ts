import Asset from 'App/Models/Asset';
import FixedIncome from 'App/Models/FixedIncome';
import Movement from 'App/Models/Movement';
import { BaseTask } from 'adonis5-scheduler/build';
import { DateTime } from 'luxon';

let time = '0 10 * * * *'
export default class ExpirationJob extends BaseTask {
  public static get schedule(){
    return time
  }
  public static get useLock(){
    return false
  }
  public async handle() {
    const movements: any = await Movement.query()
    .select('id', 'cod', 'date_operation', 'fix_id', 'type_operation')
    .where('type', 3)
    .andWhere('type_operation', 1)
    .preload('fixedIncome', (query) => {
      query.where('expired', 0)
    })

    const now = DateTime.now()

    // Identifica movimentos vencidos
    const expiredMovements = movements.filter((m) => {
      if (m.fixedIncome?.date_expiration) {
        const expiration = DateTime.fromFormat(m.fixedIncome.date_expiration, 'dd/MM/yyyy')
        return expiration < now
      }
      return false
    })

    if (expiredMovements.length === 0) {
      console.log('Nenhum ativo expirado encontrado.')
      return
    }

    console.log('Ativos expirados:', expiredMovements.map((m) => m.cod))
    // Zera quantity dos assets correspondentes
    const assetIdsToUpdate = expiredMovements.map((m) => m.cod)
    await Asset.query()
      .whereIn('cod', assetIdsToUpdate)
      .update({ quantity: 0 })

     // Marca FixedIncome como expired
     const fixedIncomeIdsToUpdate = expiredMovements
     .map((m) => m.fixedIncome?.id)
     .filter(Boolean)

   if (fixedIncomeIdsToUpdate.length > 0) {
     await FixedIncome.query()
       .whereIn('id', fixedIncomeIdsToUpdate)
       .update({ expired: 1 })
   }

   console.log('Assets atualizados e FixedIncome expirado marcado.')
  }
}
