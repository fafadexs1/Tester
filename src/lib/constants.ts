
export const ITEM_TYPE_BLOCK = 'block';
export const NODE_WIDTH = 320; // w-80 in Tailwind
export const NODE_HEADER_HEIGHT_APPROX = 40; // Altura aproximada do header do nó para cálculo de offset
export const NODE_HEADER_CONNECTOR_Y_OFFSET = NODE_HEADER_HEIGHT_APPROX / 2; // Offset para o conector default a partir do topo do nó (centro do header)
export const NODE_CENTER_Y_OFFSET = NODE_HEADER_HEIGHT_APPROX / 2; // Quando dropping, offset para centralizar verticalmente no mouse
export const NODE_DRAG_HANDLE_OFFSET_X = NODE_WIDTH / 2; // Quando dropping, offset para centralizar horizontalmente no mouse
export const GRID_SIZE = 20; // Tamanho das células da grade para o padrão de fundo

// Constantes para o nó de início com gatilhos dinâmicos
export const START_NODE_TRIGGER_INITIAL_Y_OFFSET = 40; // Offset Y do primeiro gatilho a partir do topo do conteúdo do nó
export const START_NODE_TRIGGER_SPACING_Y = 35;      // Espaçamento vertical entre os conectores de gatilho
export const START_NODE_TRIGGER_AREA_MIN_HEIGHT = 50; // Altura mínima da área de conteúdo do nó de início

// Constantes para o nó de Múltipla Escolha com handles dinâmicos
export const OPTION_NODE_HANDLE_INITIAL_Y_OFFSET = 65; // Offset Y do primeiro handle de opção (considerando o campo de pergunta)
export const OPTION_NODE_HANDLE_SPACING_Y = 30;      // Espaçamento vertical entre os conectores de opção

// Constantes de Zoom
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 0.1;

