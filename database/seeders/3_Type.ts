import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Type from 'App/Models/Type'
export default class TypeSeeder extends BaseSeeder {
  public async run () {
    await Type.createMany([
      { title: 'FIIs', full_title: 'Fundos Imobiliarios', hex: '#00A7D7' },
      { title: 'Ações', full_title: 'Ações', hex: '#1BAA9C' },
      { title: 'RF', full_title: 'Renda Fixa', hex: '#3E1191' },
      // { title: 'ETFs', full_title: 'Fundo negociado em bolsa', hex: '#d7f584' },
      // { title: 'COE', full_title: 'Certificado de Operações Estruturadas', hex: '#662d2d' },
    ])
  }
}
