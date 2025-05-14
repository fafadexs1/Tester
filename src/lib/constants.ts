
export const ITEM_TYPE_BLOCK = 'block';
export const NODE_WIDTH = 320; // w-80 in Tailwind
export const NODE_HEADER_HEIGHT_APPROX = 50; // Approximate height of the node header for connector placement
export const NODE_HEADER_CONNECTOR_Y_OFFSET = NODE_HEADER_HEIGHT_APPROX / 2 + 6; // Offset for default connector from top of node
export const NODE_CENTER_Y_OFFSET = NODE_HEADER_HEIGHT_APPROX / 2; // When dropping, offset to center vertically on mouse
export const NODE_DRAG_HANDLE_OFFSET_X = NODE_WIDTH / 2; // When dropping, offset to center horizontally on mouse
export const GRID_SIZE = 20; // Size of the grid cells for the background pattern

// Constantes para o nó de início com gatilhos dinâmicos
export const START_NODE_TRIGGER_INITIAL_Y_OFFSET = 40; // Offset Y do primeiro gatilho a partir do topo do conteúdo do nó
export const START_NODE_TRIGGER_SPACING_Y = 35;      // Espaçamento vertical entre os conectores de gatilho
export const START_NODE_TRIGGER_AREA_MIN_HEIGHT = 50; // Altura mínima da área de conteúdo do nó de início

// Constantes para o nó de Múltipla Escolha com handles dinâmicos
export const OPTION_NODE_HANDLE_INITIAL_Y_OFFSET = 65; // Offset Y do primeiro handle de opção (considerando o campo de pergunta)
export const OPTION_NODE_HANDLE_SPACING_Y = 30;      // Espaçamento vertical entre os conectores de opção
