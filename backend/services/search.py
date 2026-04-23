from __future__ import annotations

from collections import deque
from heapq import heappop, heappush
from typing import Any

from backend.core.models import ACADEMIC_GRAPH, GOAL_NODES, HEURISTIC


class AcademicSearchEngine:
    def __init__(
        self,
        graph: dict[str, list[tuple[str, float]]] | None = None,
        goals: set[str] | None = None,
        heuristic: dict[str, float] | None = None,
    ):
        self.graph = graph or ACADEMIC_GRAPH
        self.goals = goals or GOAL_NODES
        self.heuristic = heuristic or HEURISTIC

    def bfs(self, start: str, target: str) -> dict[str, Any]:
        queue = deque([(start, [start])])
        visited = set()
        explored = []
        while queue:
            node, path = queue.popleft()
            if node in visited:
                continue
            visited.add(node)
            explored.append(node)
            if node == target:
                return {"path": path, "explored": explored, "steps": len(explored)}
            for neighbor, _ in self.graph.get(node, []):
                if neighbor not in visited:
                    queue.append((neighbor, path + [neighbor]))
        return {"path": [], "explored": explored, "steps": len(explored)}

    def dfs(self, start: str, target: str) -> dict[str, Any]:
        stack = [(start, [start])]
        visited = set()
        explored = []
        while stack:
            node, path = stack.pop()
            if node in visited:
                continue
            visited.add(node)
            explored.append(node)
            if node == target:
                return {"path": path, "explored": explored, "steps": len(explored)}
            for neighbor, _ in reversed(self.graph.get(node, [])):
                if neighbor not in visited:
                    stack.append((neighbor, path + [neighbor]))
        return {"path": [], "explored": explored, "steps": len(explored)}

    def a_star(self, start: str, target: str) -> dict[str, Any]:
        open_list = [(self.heuristic.get(start, 0.0), 0.0, start, [start], {start: 0.0})]
        closed = set()
        best_g = {start: 0.0}
        trace = []

        while open_list:
            f_score, g_score, node, path, g_values = heappop(open_list)
            if node in closed:
                continue
            closed.add(node)
            h_score = self.heuristic.get(node, 0.0)
            trace.append({
                "node": node,
                "g": round(g_score, 3),
                "h": round(h_score, 3),
                "f": round(f_score, 3),
            })
            if node == target:
                return {
                    "path": path,
                    "total_cost": round(g_score, 3),
                    "trace": trace,
                    "g_values": g_values,
                }
            for neighbor, cost in self.graph.get(node, []):
                if neighbor in closed:
                    continue
                new_g = g_score + cost
                if new_g < best_g.get(neighbor, float("inf")):
                    best_g[neighbor] = new_g
                    h_neighbor = self.heuristic.get(neighbor, 0.0)
                    heappush(
                        open_list,
                        (
                            new_g + h_neighbor,
                            new_g,
                            neighbor,
                            path + [neighbor],
                            {**g_values, neighbor: round(new_g, 3)},
                        ),
                    )

        return {"path": [], "total_cost": float("inf"), "trace": trace, "g_values": {}}
