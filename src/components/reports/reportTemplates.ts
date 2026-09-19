export interface ReportTemplateDef {
  key: string
  title: string
  subtitle?: string
  category: "laudo" | "declaracao"
  shortDesc: string
  badgeLabel: string
  defaultText: string
  defaultCid?: string
  hasTimeRange?: boolean
  hasDoubleBorder?: boolean
}

export const OFFICIAL_REPORT_TEMPLATES: ReportTemplateDef[] = [
  {
    key: "laudo_fisio_3x",
    title: "LAUDO",
    category: "laudo",
    badgeLabel: "Fisioterapia 3x/sem",
    shortDesc: "Redução de dor, ganho de força muscular e arco de movimento",
    defaultText:
      "encontra-se em tratamento 3 (três) vezes por semana de Fisioterapia para ter uma redução do quadro álgico, aumento da força muscular e ganho do arco de movimento.",
    defaultCid: "M54.5",
    hasTimeRange: false,
    hasDoubleBorder: false,
  },
  {
    key: "laudo_cirurgias_3x",
    title: "LAUDO",
    category: "laudo",
    badgeLabel: "Cirurgias & Fraturas",
    shortDesc: "Histórico de fraturas, entorses ou cirurgias prévias",
    defaultText:
      "apresenta histórico de cirurgias, fraturas, entorses ou luxações e por isso deve fazer fisioterapia pelo menos 3 vezes por semana.",
    defaultCid: "S83.0",
    hasTimeRange: false,
    hasDoubleBorder: false,
  },
  {
    key: "laudo_fisio_diario",
    title: "LAUDO",
    category: "laudo",
    badgeLabel: "Fisioterapia Diária",
    shortDesc: "Tratamento diário intensivo de reabilitação e controle álgico",
    defaultText:
      "encontra-se em tratamento diário de Fisioterapia para ter uma redução do quadro álgico, aumento da força muscular e ganho do arco de movimento.",
    defaultCid: "M54.5",
    hasTimeRange: false,
    hasDoubleBorder: false,
  },
  {
    key: "laudo_rpg_3x",
    title: "LAUDO",
    category: "laudo",
    badgeLabel: "R.P.G Postural",
    shortDesc: "Redução de dores na coluna, escoliose e hérnias de disco",
    defaultText:
      "encontra-se em tratamento R.P.G para redução das dores cervicais, dorsais e/ou lombares e correção postural (escoliose e hernias de disco) por 3 vezes na semana.",
    defaultCid: "M41.9",
    hasTimeRange: false,
    hasDoubleBorder: false,
  },
  {
    key: "declaracao_comparecimento",
    title: "CLÍNICA DE FISIOTERAPIA",
    subtitle: "Declaração de Comparecimento",
    category: "declaracao",
    badgeLabel: "Declaração",
    shortDesc: "Atestado oficial de comparecimento com data e intervalo de horário",
    defaultText:
      "Declaro para os devidos fins, que o(a) Sr(a) {PACIENTE} esteve em nosso consultório no dia {DATA_SESSAO} das {HORA_INICIO} às {HORA_FIM} horas, realizando tratamento fisioterapêutico.",
    hasTimeRange: true,
    hasDoubleBorder: true,
  },
  {
    key: "laudo_livre",
    title: "LAUDO",
    category: "laudo",
    badgeLabel: "Modelo Livre",
    shortDesc: "Texto personalizado em branco para redação clínica livre",
    defaultText:
      "Atesto para os devidos fins que o(a) paciente acima qualificado(a) encontra-se em acompanhamento fisioterapêutico nesta unidade clínica, apresentando necessidade de continuidade das condutas cinesioterapêuticas prescritas.",
    defaultCid: "",
    hasTimeRange: false,
    hasDoubleBorder: false,
  },
]
