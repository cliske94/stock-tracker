Repository overview (Graphviz DOT)

This file describes the top-level structure and relationships of the repository using Graphviz DOT notation. Save this file as-is and render with `dot -Tpng repo.dot -o repo.png` after extracting the DOT block.

```dot
digraph Repo {
  rankdir=LR;
  node [shape=box, style=filled, fillcolor="#f6f8fa", color="#333333"];

  subgraph cluster_three_renderer {
    label="three_renderer (Node/Express)";
    style=rounded; color="#cfe3ff";
    three_renderer_tools [label="tools/ (generate, analyze, headless)"];
    three_renderer_public [label="public/ (viewer pages, model_meta.json)"];
    three_renderer_app [label="app.js (dev POST endpoints)"];
  }

  subgraph cluster_visuals {
    label="Visualizations"; style=rounded; color="#e6f7e6";
    viewer_gltf [label="viewer_gltf.html (3D viewer)"];
    force_graph [label="force_graph.html (D3)" shape=ellipse];
    treemap [label="treemap.html (D3)" shape=ellipse];
    matrix_heatmap [label="matrix_heatmap.html (matrix/canvas)" shape=ellipse];
  }

  subgraph cluster_data {
    label="Semantic Model & Metrics"; style=rounded; color="#fff0d6";
    model_meta [label="public/model_meta.json" shape=note, fillcolor="#fffbe6"];
    model_meta_time [label="public/model_meta_time.json" shape=note, fillcolor="#fffbe6"];
    model_meta_metrics [label="public/model_meta_metrics.json" shape=note, fillcolor="#fffbe6"];
  }

  subgraph cluster_django {
    label="django_help (Help site)"; style=rounded; color="#f3e6ff";
    helpsite_templates [label="helpcenter/templates/help_pages"];
    helpsite_views [label="helpcenter/views.py"];
  }

  subgraph cluster_k8s {
    label="k8s / Deployment"; style=rounded; color="#fbe6e6";
    three_renderer_deploy [label="k8s three-renderer Deployment/Service"];
  }

  subgraph cluster_containers {
    label="Containers (running images)"; style=rounded; color="#e8f0ff";
    three_renderer_ctr [label="three-renderer\nimage: three-renderer:latest\nport: 9092\nrole: serves visualizer & dev endpoints", shape=component];
    cpp_stock_ui_ctr [label="cpp-stock-ui\nimage: cpp-stock-ui:latest\nport: 8080\nrole: C++ UI + sidecar", shape=component];
    python_watchlist_ctr [label="python-watchlist-gui\nimage: python-watchlist-gui:latest\nport: 8081\nrole: Python GUI (noVNC)" , shape=component];
    dashboard_service_ctr [label="dashboard-service\nimage: dashboard-service:latest\nport: 5000\nrole: Flask dashboard", shape=component];
    prometheus_ctr [label="prometheus\nimage: prom/prometheus:latest\nport: 9090\nrole: metrics collection", shape=component];
    grafana_ctr [label="grafana\nimage: grafana/grafana:latest\nport: 3000\nrole: dashboards", shape=component];
    loki_ctr [label="loki\nimage: grafana/loki:latest\nport: 3100\nrole: logs storage", shape=component];
    spring_backend_ctr [label="spring-backend\nimage: spring-backend:latest\nport: 8080\nrole: backend API", shape=component];
    angular_ui_ctr [label="angular-ui\nimage: angular-ui:latest\nport: 4200\nrole: frontend", shape=component];
  }

  // Relationships
  three_renderer_tools -> model_meta [label="writes/updates model_meta.json", color="#666"];
  model_meta -> viewer_gltf [label="loaded by 3D viewer", color="#1f77b4"];
  model_meta -> force_graph [label="loaded by force graph", color="#1f77b4"];
  model_meta -> treemap [label="loaded by treemap", color="#1f77b4"];
  model_meta -> matrix_heatmap [label="loaded by matrix heatmap", color="#1f77b4"];

  three_renderer_app -> three_renderer_public [label="serves files on port 9092"];
  three_renderer_public -> viewer_gltf [label="contains viewer pages"];

  helpsite_views -> helpsite_templates [label="renders help templates"];
  helpsite_templates -> viewer_gltf [label="embeds via iframe (localhost:9095)", style=dashed];
  helpsite_templates -> force_graph [label="embeds force_graph.html", style=dashed];
  helpsite_templates -> treemap [label="embeds treemap.html", style=dashed];

  three_renderer_deploy -> three_renderer_app [label="runs three_renderer service in cluster"];
  three_renderer_deploy -> three_renderer_public [label="hosts public/ assets"];

  // container-level relations
  three_renderer_ctr -> three_renderer_public [label="serves public/ (viewer pages)"];
  dashboard_service_ctr -> model_meta_metrics [label="pushes metrics" , style=dotted];
  prometheus_ctr -> grafana_ctr [label="scraped by / visualized in", style=dashed];
  loki_ctr -> grafana_ctr [label="logs accessible via", style=dashed];


  // examples and other components
  subgraph cluster_examples { label="Other folders"; style=dotted; examples [label="examples/, src/, services/, cpp_stock_ui/ "]; }
  examples -> three_renderer_tools [label="can feed generators / be analyzed", style=dotted];

  // styling
  viewer_gltf, force_graph, treemap, matrix_heatmap [fillcolor="#ffffff"];
}
```

Notes:
- The DOT block above focuses on the runtime relationships: tooling → generated model → visualizations → embedded docs.
- To render, copy the DOT block into a `.dot` file and run Graphviz (e.g., `dot -Tpng repo.dot -o repo.png`).

File created: README_GRAPHVIZ.md
