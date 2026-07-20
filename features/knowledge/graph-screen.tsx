import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';

import { getDb } from '@/core/db';
import { listAllNoteLinks, listAllNotes } from '@/core/db/repositories';
import { useTheme } from '@/core/theme';

/**
 * Knowledge graph (M11, DESIGN 5.15): nodes = concepts/notes/videos,
 * edges = note_links; d3-force layout at runtime (ARCHITECTURE §4), filter
 * chips by type, tap → note detail. Fully local, no network.
 */

type NodeType = 'concept' | 'note' | 'video';

interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  type: NodeType;
  noteId?: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

type Filter = 'all' | 'concept' | 'video';

export function GraphScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const height = Math.min(width * 1.1, 560);

  const [filter, setFilter] = useState<Filter>('all');
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const db = await getDb();
        if (!db) return;
        const [allNotes, allLinks] = await Promise.all([listAllNotes(db), listAllNoteLinks(db)]);
        if (cancelled) return;

        const graphNodes: GraphNode[] = [];
        const noteToNodeId = new Map<number, string>();
        for (const note of allNotes) {
          const nodeId = `n${note.id}`;
          noteToNodeId.set(note.id, nodeId);
          graphNodes.push({
            id: nodeId,
            label: note.title,
            type: note.type === 'concept' ? 'concept' : note.videoId ? 'video' : 'note',
            noteId: note.id,
          });
        }
        const graphEdges: GraphEdge[] = [];
        for (const link of allLinks) {
          if (link.resolved !== 1 || link.dstNoteId == null) continue;
          const source = noteToNodeId.get(link.srcNoteId);
          const target = noteToNodeId.get(link.dstNoteId);
          if (source && target) graphEdges.push({ source, target });
        }
        setNodes(graphNodes);
        setEdges(graphEdges);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const laidOut = useMemo(() => {
    const visibleNodes = nodes.filter((node) => filter === 'all' || node.type === filter);
    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    const visibleEdges = edges.filter(
      (edge) => visibleIds.has(edge.source as string) && visibleIds.has(edge.target as string),
    );
    const simNodes: GraphNode[] = visibleNodes.map((node) => ({ ...node }));
    const simulation = forceSimulation(simNodes)
      .force('charge', forceManyBody().strength(-220))
      .force('center', forceCenter(width / 2, height / 2))
      .force(
        'link',
        forceLink<GraphNode, SimulationLinkDatum<GraphNode>>(
          visibleEdges as SimulationLinkDatum<GraphNode>[],
        )
          .id((node) => node.id)
          .distance(110),
      )
      .stop();
    simulation.tick(240);
    return { nodes: simNodes, edges: visibleEdges };
  }, [nodes, edges, filter, width, height]);

  const byId = useMemo(
    () => new Map<string, GraphNode>(laidOut.nodes.map((node) => [node.id, node])),
    [laidOut],
  );

  const nodeColor = (type: NodeType): string =>
    type === 'concept'
      ? theme.colors.accentPrimary
      : type === 'video'
        ? theme.colors.info
        : theme.colors.textTertiary;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.bgBase, paddingTop: insets.top }]}
    >
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          style={{
            minHeight: theme.touchTarget.default,
            justifyContent: 'center',
            paddingRight: 12,
          }}
        >
          <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>‹</Text>
        </Pressable>
        <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>
          Wissensgraph
        </Text>
      </View>

      <View style={styles.filterRow}>
        {(
          [
            ['all', 'Alle'],
            ['concept', 'Konzepte'],
            ['video', 'Videos'],
          ] as [Filter, string][]
        ).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setFilter(value)}
            accessibilityRole="button"
            accessibilityLabel={`Filter ${label}`}
            style={[
              styles.filterChip,
              {
                borderColor:
                  filter === value ? theme.colors.accentPrimary : theme.colors.lineSubtle,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {laidOut.nodes.length === 0 ? (
        <Text style={[theme.typography.body, { color: theme.colors.textTertiary }]}>
          Noch kein Graph — analysiere Videos, dann verlinken sich Notizen und Konzepte.
        </Text>
      ) : (
        <View
          style={[
            styles.canvas,
            {
              borderColor: theme.colors.lineSubtle,
              borderRadius: theme.radius.lg,
              height,
            },
          ]}
        >
          <Svg width="100%" height="100%">
            {laidOut.edges.map((edge, index) => {
              const source = byId.get(edge.source as string);
              const target = byId.get(edge.target as string);
              if (!source?.x || !source?.y || !target?.x || !target?.y) return null;
              return (
                <Line
                  key={`e${index}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={theme.colors.lineSubtle}
                  strokeWidth={1.5}
                />
              );
            })}
            {laidOut.nodes.map((node) => (
              <React.Fragment key={node.id}>
                <Circle
                  cx={node.x}
                  cy={node.y}
                  r={node.type === 'concept' ? 16 : 11}
                  fill={nodeColor(node.type)}
                  opacity={0.9}
                  onPress={() => node.noteId != null && router.push(`/notes/${node.noteId}`)}
                />
                <SvgText
                  x={node.x}
                  y={(node.y ?? 0) + (node.type === 'concept' ? 30 : 24)}
                  fontSize={11}
                  fill={theme.colors.textSecondary}
                  textAnchor="middle"
                >
                  {node.label.length > 18 ? `${node.label.slice(0, 17)}…` : node.label}
                </SvgText>
              </React.Fragment>
            ))}
          </Svg>
        </View>
      )}

      <View style={styles.legendRow}>
        <LegendDot color={theme.colors.accentPrimary} label="Konzept" theme={theme} />
        <LegendDot color={theme.colors.textTertiary} label="Notiz" theme={theme} />
        <LegendDot color={theme.colors.info} label="Video" theme={theme} />
      </View>
    </View>
  );
}

function LegendDot({
  color,
  label,
  theme,
}: {
  color: string;
  label: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  canvas: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
