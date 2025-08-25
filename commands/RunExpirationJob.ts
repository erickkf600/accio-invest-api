import { BaseCommand } from '@adonisjs/core/build/standalone'
import Asset from 'App/Models/Asset'
import FixedIncome from 'App/Models/FixedIncome'
import Movement from 'App/Models/Movement'
import { DateTime } from 'luxon'

export default class RunExpirationJob extends BaseCommand {
  public static commandName = 'run:execute_job'
  public static description = ''

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
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
      console.log('Nenhum ativo expirado encontrado')
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
