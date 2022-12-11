import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Type from 'App/Models/Type'
export default class TypeSeeder extends BaseSeeder {
  public async run () {
    await Type.createMany([
      { title: 'FIIs', full_title: 'Fundos Imobiliarios' },
      { title: 'Ações', full_title: 'Ações' },
      { title: 'Renda Fixa', full_title: 'Renda Fixa' },
      { title: 'ETFs', full_title: 'Fundo negociado em bolsa' },
      { title: 'COE', full_title: 'Certificado de Operações Estruturadas' },
    ])
  }
}
