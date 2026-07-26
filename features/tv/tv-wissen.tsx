import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
} from 'd3-force';

import { getDb } from '@/core/db';
import { listAllNoteLinks, listAllNotes, type NoteRow } from '@/core/db/repositories';
import { useTheme } from '@/core/theme';

import { tvType } from './tv-type';

interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  type: 'concept' | 'note' | 'video';
}

interface GraphEdge {
  source: string;
  target: string;
}

/**
 * TV knowledge view (phase 12, ROADMAP: "Wissen/Graph nur Ansicht"): recent
 * notes list + the link graph as a static canvas — view-only, no editing and
 * no navigation (PRD: TV is a consumption view).
 */
export function TVWissen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const db = await getDb();
      if (!db) return;
      const [allNotes, allLinks] = await Promise.all([listAllNotes(db), listAllNoteLinks(db)]);
      if (cancelled) return;
      setNotes(allNotes.slice(0, 20));

      const graphNodes: GraphNode[] = [];
      const noteToNodeId = new Map<number, string>();
      for (const note of allNotes) {
        const nodeId = `n${note.id}`;
        noteToNodeId.set(note.id, nodeId);
        graphNodes.push({
          id: nodeId,
          label: note.title,
          type: note.type === 'concept' ? 'concept' : note.videoId ? 'video' : 'note',
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
  }, []);

  const graphWidth = Math.min(width - 192, 1400);
  const graphHeight = Math.round(graphWidth * 0.5);

  const laidOut = useMemo(() => {
    if (nodes.length === 0)
      return { nodes: [] as GraphNode[], edges: [] as { source: GraphNode; target: GraphNode }[] };
    const simNodes = nodes.map((n) => ({ ...n }));
    const sim = forceSimulation(simNodes)
      .force('charge', forceManyBody().strength(-220))
      .force('center', forceCenter(graphWidth / 2, graphHeight / 2))
      .force(
        'link',
        forceLink<GraphNode, { source: string; target: string }>(edges.map((e) => ({ ...e })))
          .id((n) => n.id)
          .distance(110),
      )
      .stop();
    for (let i = 0; i < 160; i++) sim.tick();
    const byId = new Map(simNodes.map((n) => [n.id, n]));
    const laidEdges = edges
      .map((e) => ({ source: byId.get(e.source)!, target: byId.get(e.target)! }))
      .filter((e) => e.source && e.target);
    return { nodes: simNodes, edges: laidEdges };
  }, [nodes, edges, graphWidth, graphHeight]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text
        style={[
          tvType(theme.typography.title3),
          styles.label,
          { color: theme.colors.textSecondary },
        ]}
      >
        GRAPH ({nodes.length} Notizen · {edges.length} Links)
      </Text>
      {laidOut.nodes.length > 0 && (
        <Svg width={graphWidth} height={graphHeight}>
          {laidOut.edges.map((edge, i) => (
            <Line
              key={`e${i}`}
              x1={edge.source.x}
              y1={edge.source.y}
              x2={edge.target.x}
              y2={edge.target.y}
              stroke={theme.colors.lineSubtle}
              strokeWidth={1.5}
            />
          ))}
          {laidOut.nodes.map((node) => (
            <React.Fragment key={node.id}>
              <Circle
                cx={node.x}
                cy={node.y}
                r={node.type === 'concept' ? 14 : 10}
                fill={
                  node.type === 'concept'
                    ? theme.colors.accentPrimary
                    : node.type === 'video'
                      ? theme.colors.textSecondary
                      : theme.colors.info
                }
              />
              <SvgText
                x={node.x! + 18}
                y={node.y! + 5}
                fill={theme.colors.textSecondary}
                fontSize={16}
              >
                {node.label.length > 24 ? `${node.label.slice(0, 24)}…` : node.label}
              </SvgText>
            </React.Fragment>
          ))}
        </Svg>
      )}

      <Text
        style={[
          tvType(theme.typography.title3),
          styles.label,
          { color: theme.colors.textSecondary },
        ]}
      >
        NOTIZEN
      </Text>
      {notes.map((note) => (
        <View
          key={note.id}
          style={[
            styles.noteRow,
            { backgroundColor: theme.colors.bgElevated, borderRadius: theme.radius.md },
          ]}
        >
          <Text
            style={[tvType(theme.typography.bodyStrong), { color: theme.colors.textPrimary }]}
            numberOfLines={1}
          >
            {note.title}
          </Text>
          <Text style={[tvType(theme.typography.caption), { color: theme.colors.textTertiary }]}>
            {note.type}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: 20, paddingBottom: 48 },
  label: { letterSpacing: 1.5, marginTop: 12 },
  noteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16,
  },
});
