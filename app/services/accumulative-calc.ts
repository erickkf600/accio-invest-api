
export default class AccumulativeCalc {

  public async someTotais(totais: any[]){
    let acumulado = 0;
    return totais.map(item => {
      acumulado += parseFloat(item); // converte string para número e soma acumulativa
      return acumulado.toFixed(2); // mantém 2 casas decimais
    });
  }
}
