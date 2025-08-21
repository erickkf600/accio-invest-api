import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Operation from 'App/Models/Operation'
export default class OperationSeeder extends BaseSeeder {
  public async run () {
    await Operation.updateOrCreateMany('title', [
      { title: 'Compra', full_title: 'Compra de ativo' },
      { title: 'Venda', full_title: 'Venda de ativo' },
      { title: 'Dividendos', full_title: 'Recebimento de dividendos' },
      { title: 'Desdobramentos', full_title: 'Realizar operação de desdobramento' },
      { title: 'Aluguel', full_title: 'Rendimento de Aluguel de ações' },
    ])
  }
}
