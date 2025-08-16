import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Change from 'App/Models/Change'

export default class ChangeSeeder extends BaseSeeder {
  public async run () {
    await Change.updateOrCreateMany('change_type', [
      {change_type:'split', change_type_title: 'Desdobramento'},
      {change_type:'inplit', change_type_title: 'Agrupamento'}
    ])
  }
}
