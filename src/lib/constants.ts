
export const ITEM_TYPE_BLOCK = 'block';
export const NODE_WIDTH = 320; // w-80 in Tailwind
export const NODE_HEADER_HEIGHT_APPROX = 40; // Altura aproximada do header do nó para cálculo de offset
export const NODE_HEADER_CONNECTOR_Y_OFFSET = NODE_HEADER_HEIGHT_APPROX / 2; // Offset para o conector default a partir do topo do nó (centro do header)
export const NODE_CENTER_Y_OFFSET = NODE_HEADER_HEIGHT_APPROX / 2; // Quando dropping, offset para centralizar verticalmente no mouse
export const NODE_DRAG_HANDLE_OFFSET_X = NODE_WIDTH / 2; // Quando dropping, offset para centralizar horizontalmente no mouse
export const GRID_SIZE = 20; // Tamanho das células da grade para o padrão de fundo

// Constantes para o nó de início com gatilhos dinâmicos
// Constantes para o nó de Início (StartNode)
export const START_NODE_HEADER_HEIGHT = 72; // Altura do header com ícone e título
export const START_NODE_TRIGGER_INITIAL_Y_OFFSET = 30; // Offset Y inicial relativo à área de conteúdo
export const START_NODE_TRIGGER_SPACING_Y = 32;      // Altura/Espaçamento de cada gatilho (TriggerBlock)
export const START_NODE_KEYWORD_SPACING_Y = 24;      // Altura para cada keyword extra

// Constantes para o nó de Opção (OptionNode)
export const OPTION_NODE_PROMPT_HEIGHT = 100; // Altura aproximada da área da pergunta (textarea + toolbar)
export const OPTION_NODE_OPTION_HEIGHT = 42; // Altura de cada linha de opção (input + button + spacing)
export const OPTION_NODE_INITIAL_OFFSET_Y = 80; // Offset inicial do primeiro handle de opção (pula header + pergunta)

// Constantes para o nó de Switch (SwitchNode)
export const SWITCH_NODE_VAR_HEIGHT = 60; // Altura da área de variável
export const SWITCH_NODE_CASE_HEIGHT = 42; // Altura de cada caso
export const SWITCH_NODE_INITIAL_OFFSET_Y = 75; // Offset inicial do primeiro caso

// Constantes Genéricas
export const NODE_PADDING_Y = 20; // Padding vertical padrão do conteúdo do nó

// Constantes de Zoom
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 0.1;

