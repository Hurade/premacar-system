import React, { useMemo, useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Zap, Filter, PlayCircle, Save } from 'lucide-react';
import { Button } from '@/components/Button';
import { AutomationRule, AutomationAction } from '@/hooks/useAutomationRules';

const TRIGGER_LABELS: Record<string, string> = {
  new_message: 'Nova mensagem',
  tag_applied: 'Tag aplicada',
  stage_changed: 'Mudança de estágio',
};

const ACTION_LABELS: Record<string, string> = {
  send_message: 'Enviar mensagem',
  apply_tag: 'Aplicar tag',
  remove_tag: 'Remover tag',
  move_stage: 'Mover estágio',
  create_task: 'Criar tarefa',
};

interface InfoNodeData {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  showTargetHandle?: boolean;
  showSourceHandle?: boolean;
}

const InfoNode: React.FC<NodeProps> = ({ data }) => {
  const d = data as unknown as InfoNodeData;
  return (
    <div
      className="rounded-xl border px-4 py-3 min-w-[220px] shadow-lg bg-slate-900"
      style={{ borderColor: d.color }}
    >
      {d.showTargetHandle && <Handle type="target" position={Position.Top} />}
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: d.color }}>
        {d.icon}
        {d.title}
      </div>
      {d.subtitle && <p className="text-sm text-slate-200 mt-1">{d.subtitle}</p>}
      {d.showSourceHandle && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
};

const nodeTypes = { info: InfoNode };

interface FlowCanvasProps {
  rule: AutomationRule;
  onReorderActions: (newActions: AutomationAction[]) => void;
}

const V_SPACING = 130;

const FlowCanvas: React.FC<FlowCanvasProps> = ({ rule, onReorderActions }) => {
  const initialNodes: Node[] = useMemo(() => {
    const nodes: Node[] = [
      {
        id: 'trigger',
        type: 'info',
        position: { x: 0, y: 0 },
        data: {
          title: 'Gatilho',
          subtitle: TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type,
          icon: <PlayCircle className="w-3.5 h-3.5" />,
          color: '#22d3ee',
          showSourceHandle: true,
        } satisfies InfoNodeData,
        draggable: false,
      },
      {
        id: 'conditions',
        type: 'info',
        position: { x: 0, y: V_SPACING },
        data: {
          title: `Condições (${rule.conditions_logic})`,
          subtitle: rule.conditions.length > 0
            ? rule.conditions.map(c => `${c.field} ${c.operator} ${c.value}`).join(' · ')
            : 'Sem condições — sempre executa',
          icon: <Filter className="w-3.5 h-3.5" />,
          color: '#a78bfa',
          showTargetHandle: true,
          showSourceHandle: true,
        } satisfies InfoNodeData,
        draggable: false,
      },
    ];

    rule.actions.forEach((action, idx) => {
      nodes.push({
        id: `action-${idx}`,
        type: 'info',
        position: { x: 0, y: V_SPACING * (2 + idx) },
        data: {
          title: `Ação ${idx + 1}`,
          subtitle: `${ACTION_LABELS[action.type] || action.type}${action.params?.message ? `: "${action.params.message.slice(0, 40)}"` : ''}`,
          icon: <Zap className="w-3.5 h-3.5" />,
          color: '#fbbf24',
          showTargetHandle: true,
        } satisfies InfoNodeData,
        draggable: true,
      });
    });

    return nodes;
  }, [rule]);

  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [{ id: 'e-trigger-conditions', source: 'trigger', target: 'conditions' }];
    rule.actions.forEach((_, idx) => {
      edges.push({
        id: `e-${idx === 0 ? 'conditions' : `action-${idx - 1}`}-action-${idx}`,
        source: idx === 0 ? 'conditions' : `action-${idx - 1}`,
        target: `action-${idx}`,
      });
    });
    return edges;
  }, [rule]);

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges] = useState<Edge[]>(initialEdges);
  const [isDirty, setIsDirty] = useState(false);

  React.useEffect(() => {
    setNodes(initialNodes);
    setIsDirty(false);
  }, [initialNodes]);

  const handleNodeDragStop = useCallback(() => {
    setIsDirty(true);
  }, []);

  const handleNodesChange = useCallback((changes: any[]) => {
    setNodes((nds) => {
      const next = [...nds];
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          const idx = next.findIndex(n => n.id === change.id);
          if (idx !== -1) next[idx] = { ...next[idx], position: change.position };
        }
      });
      return next;
    });
  }, []);

  const handleSaveOrder = () => {
    const actionNodes = nodes.filter(n => n.id.startsWith('action-'));
    const sorted = [...actionNodes].sort((a, b) => a.position.y - b.position.y);
    const newActions = sorted.map(n => {
      const idx = Number(n.id.replace('action-', ''));
      return rule.actions[idx];
    });
    onReorderActions(newActions);
    setIsDirty(false);
  };

  if (rule.actions.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-slate-500 border border-slate-800 rounded-xl bg-slate-950/40">
        Esta automação ainda não tem ações configuradas.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {isDirty && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSaveOrder} className="gap-2">
            <Save className="w-3.5 h-3.5" />
            Salvar nova ordem das ações
          </Button>
        </div>
      )}
      <div style={{ height: Math.max(320, V_SPACING * (rule.actions.length + 2)) }} className="border border-slate-800 rounded-xl bg-slate-950/40 overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onNodeDragStop={handleNodeDragStop}
          proOptions={{ hideAttribution: true }}
          fitView
        >
          <Background color="#1e293b" gap={16} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <p className="text-xs text-slate-500">Arraste os nós de ação verticalmente para reordenar, depois clique em "Salvar nova ordem".</p>
    </div>
  );
};

export default FlowCanvas;
