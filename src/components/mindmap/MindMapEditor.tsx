'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Node, Edge, addEdge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, Connection, NodeTypes,
  Panel, NodeProps, Handle, Position, BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Box, Button, Typography, TextField, IconButton, Tooltip,
  Popover, Paper, Stack, Divider, alpha, useTheme, CircularProgress,
  Chip,
} from '@mui/material';
import {
  Save, ArrowBack, Add, Delete, ZoomIn, ZoomOut,
  FitScreen, Palette, TextFields, AddCircle,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { BRAND_GRADIENT } from '@/theme';

// ─── Node Colors ────────────────────────────────────────────────────────────

const NODE_COLORS = [
  '#F2B705', '#FFD34D', '#22C55E', '#F59E0B',
  '#EF4444', '#EC4899', '#27272A', '#111113',
  '#14B8A6', '#D4A017',
];

// ─── Custom Node ────────────────────────────────────────────────────────────

function MindNode({ id, data, selected }: NodeProps) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
  const theme = useTheme();

  const handleDoubleClick = () => setEditing(true);

  const handleBlur = () => {
    setEditing(false);
    data.onLabelChange?.(id, label);
  };

  return (
    <Box
      onDoubleClick={handleDoubleClick}
      sx={{
        px: 2, py: 1,
        minWidth: 120, maxWidth: 220,
        borderRadius: 3,
        background: data.color || BRAND_GRADIENT,
        color: '#fff',
        fontWeight: 600,
        fontSize: data.isRoot ? 16 : 14,
        boxShadow: selected
          ? `0 0 0 3px #fff, 0 0 0 5px ${data.color || '#F2B705'}`
          : '0 4px 16px rgba(0,0,0,0.25)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        position: 'relative',
        textAlign: 'center',
        userSelect: 'none',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      {editing ? (
        <TextField
          autoFocus
          size="small"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
          variant="standard"
          inputProps={{
            style: {
              color: '#fff', fontWeight: 600, textAlign: 'center',
              fontSize: data.isRoot ? 16 : 14,
            },
          }}
          sx={{
            width: '100%',
            '& .MuiInput-underline:before': { borderColor: 'rgba(255,255,255,0.5)' },
            '& .MuiInput-underline:after': { borderColor: '#fff' },
          }}
        />
      ) : (
        <Typography
          sx={{ fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', wordBreak: 'break-word' }}
        >
          {label}
        </Typography>
      )}
    </Box>
  );
}

const nodeTypes: NodeTypes = { mindNode: MindNode };

// ─── MindMapEditor ──────────────────────────────────────────────────────────

interface MindMapEditorProps {
  map: { id: string; title: string; data: { nodes: Node[]; edges: Edge[] } };
  onSave: (data: any) => Promise<any>;
  onBack: () => void;
  isSaving: boolean;
}

export default function MindMapEditor({ map, onSave, onBack, isSaving }: MindMapEditorProps) {
  const theme = useTheme();
  const reactFlowRef = useRef<any>(null);

  // Inject callbacks into existing nodes
  const injectCallbacks = (nodes: Node[]) =>
    nodes.map((n) => ({
      ...n,
      type: 'mindNode',
      data: {
        ...n.data,
        onLabelChange: handleLabelChange,
      },
    }));

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [title, setTitle] = useState(map.title);
  const [selectedColor, setSelectedColor] = useState(NODE_COLORS[0]);
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // 🔥 FUNÇÃO VEM ANTES DE QUALQUER USO
  const handleLabelChange = useCallback((nodeId: string, newLabel: string) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, label: newLabel } }
          : n
      )
    );
    setHasChanges(true);
  }, [setNodes]);

  // 🔥 INJETA CALLBACKS DE FORMA SEGURA
  useEffect(() => {
    const injectedNodes = (map.data?.nodes || []).map((n) => ({
      ...n,
      type: 'mindNode',
      data: {
        ...n.data,
        onLabelChange: handleLabelChange,
      },
    }));

    setNodes(injectedNodes);
    setEdges(map.data?.edges || []);
  }, [map, handleLabelChange, setNodes, setEdges]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({
      ...connection,
      style: { stroke: selectedColor, strokeWidth: 2 },
      animated: false,
    }, eds));
    setHasChanges(true);
  }, [setEdges, selectedColor]);

  const addNode = useCallback(() => {
    const id = `node_${Date.now()}`;
    const center = reactFlowRef.current
      ? { x: 400 + Math.random() * 200 - 100, y: 200 + Math.random() * 200 - 100 }
      : { x: 400, y: 300 };

    const newNode: Node = {
      id,
      type: 'mindNode',
      position: center,
      data: {
        label: 'Novo Tópico',
        color: selectedColor,
        onLabelChange: handleLabelChange,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setHasChanges(true);
  }, [setNodes, selectedColor, handleLabelChange]);

  const addChildNode = useCallback(() => {
    if (!selectedNode) { toast.error('Selecione um nó primeiro'); return; }

    const parent = nodes.find((n) => n.id === selectedNode);
    if (!parent) return;

    const id = `node_${Date.now()}`;
    const newNode: Node = {
      id,
      type: 'mindNode',
      position: { x: parent.position.x + 150, y: parent.position.y + 100 },
      data: {
        label: 'Sub-tópico',
        color: selectedColor,
        onLabelChange: handleLabelChange,
      },
    };

    const newEdge: Edge = {
      id: `edge_${Date.now()}`,
      source: selectedNode,
      target: id,
      style: { stroke: selectedColor, strokeWidth: 2 },
    };

    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [...eds, newEdge]);
    setHasChanges(true);
  }, [selectedNode, nodes, selectedColor, handleLabelChange, setNodes, setEdges]);

  const deleteSelected = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode && e.target !== selectedNode));
    setSelectedNode(null);
    setHasChanges(true);
  }, [selectedNode, setNodes, setEdges]);

  const changeSelectedColor = useCallback((color: string) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode ? { ...n, data: { ...n.data, color } } : n
      )
    );
    setSelectedColor(color);
    setColorAnchor(null);
    setHasChanges(true);
  }, [selectedNode, setNodes]);

  const handleSave = async () => {
    // Strip callbacks before saving (não serializable)
    const cleanNodes = nodes.map(({ data: { onLabelChange, ...restData }, ...rest }) => ({
      ...rest,
      data: restData,
    }));

    try {
      await onSave({ title, data: { nodes: cleanNodes, edges } });
      setHasChanges(false);
      toast.success('Mapa salvo!');
    } catch {
      toast.error('Erro ao salvar');
    }
  };

  return (
    <Box sx={{ height: 'calc(100vh - 64px - 48px)', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5, mb: 2, display: 'flex', alignItems: 'center', gap: 1,
          border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
          borderRadius: 3, flexWrap: 'wrap',
        }}
      >
        <Tooltip title="Voltar">
          <IconButton size="small" onClick={onBack}>
            <ArrowBack />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <TextField
          size="small"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setHasChanges(true); }}
          variant="standard"
          inputProps={{ style: { fontWeight: 700, fontSize: 16 } }}
          sx={{ minWidth: 200 }}
        />

        {hasChanges && (
          <Chip label="Alterações não salvas" size="small" color="warning" sx={{ ml: 1 }} />
        )}

        <Box sx={{ flexGrow: 1 }} />

        {/* Color picker */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {NODE_COLORS.slice(0, 5).map((c) => (
            <Box
              key={c}
              onClick={() => { setSelectedColor(c); changeSelectedColor(c); }}
              sx={{
                width: 22, height: 22, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                border: selectedColor === c ? '2px solid #fff' : '2px solid transparent',
                boxShadow: selectedColor === c ? `0 0 0 2px ${c}` : 'none',
                transition: 'box-shadow 0.2s',
              }}
            />
          ))}
          <Tooltip title="Mais cores">
            <IconButton size="small" onClick={(e) => setColorAnchor(e.currentTarget)}>
              <Palette fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Adicionar nó">
          <Button size="small" startIcon={<Add />} variant="outlined" onClick={addNode}>
            Nó
          </Button>
        </Tooltip>

        <Tooltip title="Adicionar filho do nó selecionado">
          <Button size="small" startIcon={<AddCircle />} variant="outlined" onClick={addChildNode}
            disabled={!selectedNode}>
            Filho
          </Button>
        </Tooltip>

        <Tooltip title="Deletar selecionado">
          <IconButton size="small" color="error" onClick={deleteSelected} disabled={!selectedNode}>
            <Delete />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Button
          variant="contained"
          startIcon={isSaving ? <CircularProgress size={14} color="inherit" /> : <Save />}
          onClick={handleSave}
          disabled={isSaving}
          sx={{ minWidth: 100 }}
        >
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
      </Paper>

      {/* React Flow Canvas */}
      <Box sx={{ flexGrow: 1, borderRadius: 3, overflow: 'hidden', border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
        <ReactFlow
          ref={reactFlowRef}
          nodes={nodes}
          edges={edges}
          onNodesChange={(changes) => { onNodesChange(changes); setHasChanges(true); }}
          onEdgesChange={(changes) => { onEdgesChange(changes); setHasChanges(true); }}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedNode(node.id)}
          onPaneClick={() => setSelectedNode(null)}
          fitView
          defaultEdgeOptions={{
            style: { stroke: selectedColor, strokeWidth: 2 },
            animated: false,
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color={alpha(theme.palette.primary.main, 0.15)}
          />
          <Controls />
          <MiniMap
            nodeColor={(n) => n.data?.color || '#F2B705'}
            maskColor={alpha(theme.palette.background.default, 0.8)}
            style={{ borderRadius: 12, overflow: 'hidden' }}
          />
          <Panel position="bottom-center">
            <Paper sx={{ px: 2, py: 0.75, borderRadius: 3, opacity: 0.8 }}>
              <Typography variant="caption" color="text.secondary">
                Duplo clique para editar · Arraste para mover · Conecte pelas bordas dos nós
              </Typography>
            </Paper>
          </Panel>
        </ReactFlow>
      </Box>

      {/* Color Popover */}
      <Popover
        open={Boolean(colorAnchor)}
        anchorEl={colorAnchor}
        onClose={() => setColorAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Box sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
            Cor do nó selecionado
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.5 }}>
            {NODE_COLORS.map((c) => (
              <Box
                key={c}
                onClick={() => changeSelectedColor(c)}
                sx={{
                  width: 28, height: 28, borderRadius: '50%', bgcolor: c,
                  cursor: 'pointer',
                  border: selectedColor === c ? '2px solid #fff' : '2px solid transparent',
                  boxShadow: selectedColor === c ? `0 0 0 2px ${c}` : '0 2px 4px rgba(0,0,0,0.2)',
                  transition: 'transform 0.1s',
                  '&:hover': { transform: 'scale(1.1)' },
                }}
              />
            ))}
          </Box>
        </Box>
      </Popover>
    </Box>
  );
}
