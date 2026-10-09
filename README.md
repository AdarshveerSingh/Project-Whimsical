# \# Project Whimsical

# 

# \*A cozy, stylized 3D RPG inspired by Studio Ghibli's art style and The Legend of Zelda.\*

# 

# > \*\*Project Whimsical is a work in progress.\*\* Its current MVP focuses on exploration, gathering, and survival, with a larger procedural world and additional gameplay systems planned for the future.

# 

# Project Whimsical is a 3D RPG prototype built using HTML, CSS, JavaScript, and Three.js. The primary goal is to capture the whimsical, cozy atmosphere of Ghibli-inspired environments while exploring how far procedural generation, custom shaders, and performance-conscious rendering can take a browser-based 3D game.

# 

# The project started as an experiment in stylized 3D rendering and gradually evolved into a larger technical exploration involving procedural terrain, vegetation, dynamic lighting, custom movement, and world-generation systems.

# 

# The project is still evolving, and many of its systems are being actively developed and optimized.

# 

# \---

# 

# \## Table of Contents

# 

# \- \[Project Overview](#project-overview)

# \- \[Tech Stack](#tech-stack)

# \- \[Getting Started](#getting-started)

# \- \[Development Journey](#development-journey)

# \- \[Grass Rendering and Procedural Wind](#grass-rendering-and-procedural-wind)

# \- \[Shaders and Stylized Lighting](#shaders-and-stylized-lighting)

# \- \[Noise and Procedural Generation](#noise-and-procedural-generation)

# \- \[Terrain Generation and Streaming](#terrain-generation-and-streaming)

# \- \[Procedural Vegetation and Prop Systems](#procedural-vegetation-and-prop-systems)

# \- \[World Generation and Chunk Management](#world-generation-and-chunk-management)

# \- \[Movement System](#movement-system)

# \- \[Performance Debugging and Optimization](#performance-debugging-and-optimization)

# \- \[Future Roadmap](#future-roadmap)

# \- \[Inspiration and References](#inspiration-and-references)

# \- \[Contributing](#contributing)

# \- \[License and Asset Usage](#license-and-asset-usage)

# 

# \---

# 

# \## Project Overview

# 

# The current version is centered around a gather-and-survive gameplay loop, supported by a procedurally generated environment.

# 

# The larger vision is to build a world that feels alive through its terrain, vegetation, lighting, environmental details, and eventually its inhabitants.

# 

# \### Current areas of development

# 

# \- Stylized 3D rendering using Three.js and custom shaders.

# \- Procedural terrain generation and chunk-based world management.

# \- Procedural placement of trees, rocks, bushes, flowers, and grass.

# \- Custom grass deformation, wind animation, and color variation.

# \- Terrain and prop Level of Detail (LOD) systems.

# \- Frustum and distance-based culling.

# \- Instanced rendering and draw-call optimization.

# \- Custom first-person movement with sprinting, dashing, and double-jump mechanics.

# \- Performance monitoring and debugging tools.

# \- Experimental procedural terrain and gesture-control prototypes.

# 

# The emphasis is not just on creating a visually appealing environment, but on understanding the rendering and systems architecture required to make a large, stylized world practical in a browser.

# 

# \---

# 

# \## Tech Stack

# 

# | Technology | Purpose |

# |---|---|

# | HTML5 | Game entry point and page structure |

# | CSS | Interface and page styling |

# | JavaScript | Gameplay, world systems, and application logic |

# | \[Three.js](https://threejs.org/) | 3D rendering, scene management, materials, and geometry |

# | \[WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL\_API) | Browser-based GPU rendering |

# | GLSL shaders | Grass animation, stylized rendering, and custom visual effects |

# | \[Vite](https://vite.dev/) | Development server and production build tooling |

# | \[simplex-noise](https://www.npmjs.com/package/simplex-noise) | Procedural noise generation |

# | \[alea](https://www.npmjs.com/package/alea) | Seeded pseudo-random number generation |

# | Web Workers | Experimental and existing background-processing workflows, depending on the system |

# | Blender | Modeling, asset creation, mesh preparation, and LOD generation |

# | Git and Git LFS | Source control and large binary assets |

# 

# The project uses custom systems built on top of Three.js rather than relying entirely on ready-made environment-generation solutions.

# 

# \---

# 

# \## Getting Started

# 

# There are two ways to obtain the project: cloning the repository or downloading the source as a ZIP.

# 

# \### Prerequisites

# 

# \- \[Node.js](https://nodejs.org/) and npm.

# \- \[Git](https://git-scm.com/) for cloning the repository.

# \- \[Git LFS](https://git-lfs.com/) if the repository uses LFS to distribute its model assets.

# \- A modern browser with WebGL support.

# \- Visual Studio Code is recommended for development.

# 

# \### Option 1: Clone the repository

# 

# Clone the repository and install its dependencies:

# 

# ```bash

# git clone YOUR\_REPOSITORY\_URL

# cd Project-Whimsical

# 

# git lfs install

# git lfs pull

# 

# npm install

# npm run dev

# ```

# 

# Replace `YOUR\\\_REPOSITORY\\\_URL` with the HTTPS URL of this repository.

# 

# Open the local URL printed by Vite in your terminal.

# 

# \*\*Important:\*\* Git LFS can download the actual models only if their corresponding LFS objects have been uploaded successfully. If some models are unavailable, use the asset download instructions below.

# 

# \### Option 2: Download the repository as a ZIP

# 

# 1\. Open this repository on GitHub.

# 2\. Select \*\*Code → Download ZIP\*\*.

# 3\. Extract the archive.

# 4\. Open the extracted project folder in Visual Studio Code.

# 5\. Open a terminal in the folder containing `package.json`.

# 6\. Install dependencies:

# 

# &#x20;  ```bash

# &#x20;  npm install

# &#x20;  ```

# 

# 7\. Download the required model assets using the link below.

# 8\. Extract the models into the expected directory.

# 9\. Start the game:

# 

# &#x20;  ```bash

# &#x20;  npm run dev

# &#x20;  ```

# 

# \### Download the required 3D models

# 

# Some large 3D assets are distributed separately from the source repository.

# 

# \*\*\[Download Project Whimsical 3D Models from Google Drive](https://drive.google.com/file/d/1Aes-bPFvX7LrCA7FTNOIsP8iJK4g1qXF/view?usp=sharing)\*\*

# 

# After downloading, extract the archive and place the model files in:

# 

# ```text

# game/

# └── models/

# &#x20;   ├── TreeMine.glb

# &#x20;   ├── rocks\_LODS2.glb

# &#x20;   ├── bushes\_gn\_shader.glb

# &#x20;   └── ...

# ```

# 

# The filenames above are examples of required assets; preserve the complete set of files and directories provided in the archive.

# 

# Make sure you have downloaded the actual model binaries, not Git LFS pointer files.

# 

# > \*\*Asset usage restriction:\*\* The 3D models and other designated art assets are not licensed for commercial use without prior permission from their respective rights holders. See \[License and Asset Usage](#license-and-asset-usage).

# 

# \### Troubleshooting

# 

# \*\*Models fail to load\*\*

# 

# \- Check that the required `.glb` files exist in `game/models/`.

# \- Confirm that the downloaded files are actual binary model files rather than LFS pointers.

# \- Check the browser console and network panel for failed asset requests.

# 

# \*\*npm reports missing scripts\*\*

# 

# Ensure you are using the project version containing the Vite configuration and `dev` script.

# 

# \*\*Dependencies fail to resolve\*\*

# 

# Run `npm install` from the directory containing `package.json`, rather than from inside `game/`.

# 

# \*\*The game runs but some assets are missing\*\*

# 

# Check the asset paths and ensure the complete model archive has been extracted into the expected directory.

# 

# \---

# 

# \## Development Journey

# 

# The game has developed incrementally through experiments with rendering, modeling, procedural generation, and performance optimization.

# 

# The following sections document that progression. Replace the video and image placeholders with your actual development footage and screenshots.

# 

# \### 1. Initial Three.js Experiments

# 

# The earliest experiments focused on understanding Three.js rendering, model loading, animation mixers, and the fundamentals of building a 3D scene in the browser.

# 

# This phase helped establish the foundation for loading animated models, controlling the scene, and experimenting with different visual styles.

# 

# \*\*Development video:\*\* \[Add initial animation mixer and rendering experiment]

# 

# `\\\[Add screenshot or video thumbnail here]`

# 

# \### 2. Modeling and Instancing

# 

# The next phase involved creating custom assets in Blender and testing how multiple copies of those assets could be rendered efficiently.

# 

# Rather than treating every object as an independent rendering operation, the project began exploring instancing and more structured approaches to placing repeated environmental props.

# 

# \*\*Development video:\*\* \[Add Blender modeling and instancing demonstration]

# 

# `\\\[Add Blender viewport screenshots and in-game results here]`

# 

# \### 3. Environmental Scale, Lighting, and Fog

# 

# Large environmental props and statues helped establish a sense of scale. Lighting and fog were then refined to create atmospheric depth and move the environment closer to the intended cozy, stylized aesthetic.

# 

# Fog also helps soften distant scenery and visually integrate objects into the environment.

# 

# \*\*Development video:\*\* \[Add statue spawning, lighting, and fog experiment]

# 

# `\\\[Add screenshots of the environment and lighting here]`

# 

# \### 4. Grass Experiments

# 

# Grass became one of the most technically interesting parts of the project. The goal was to create vegetation that moved naturally and contributed to the atmosphere without making the rendering workload impractical.

# 

# This led to experiments with custom shaders, procedural wind, deformation, color variation, and shadow behavior.

# 

# \*\*Development video:\*\* \[Add early grass experiment]

# 

# \### 5. Integrating the Environment

# 

# The later experiments focused on integrating the environment's models, terrain, vegetation, lighting, and rendering systems into a more cohesive world.

# 

# \*\*Development video:\*\* \[Add latest environment and final model demonstration]

# 

# `\\\[Add final in-game screenshots here]`

# 

# \---

# 

# \## Grass Rendering and Procedural Wind

# 

# Grass is one of the central technical features of Project Whimsical.

# 

# Its visual direction was inspired in part by \*\*rice fields\*\*: dense, flowing vegetation that responds to wind and creates a sense of movement across the landscape.

# 

# The challenge was to reproduce that feeling while keeping the number of rendered objects and the associated GPU workload under control.

# 

# \### Why custom grass shaders?

# 

# A straightforward approach to grass would create many individual meshes and animate each object separately. That becomes expensive when vegetation covers a large area.

# 

# Instead, Project Whimsical uses a custom grass-rendering approach designed to support very large numbers of blades.

# 

# The system has been tested with scenes containing more than one million grass blades, although actual performance depends on hardware, visible density, resolution, and other scene effects.

# 

# \### Wind animation

# 

# Rather than individually moving every blade through JavaScript, the grass shader calculates deformation on the GPU.

# 

# Procedural variation, including noise-based motion, helps produce a less uniform result than having every blade bend in synchronization.

# 

# The intended effect is a field of grass that responds continuously to its environment instead of behaving like a collection of rigid, identical objects.

# 

# \### Bending and lighting-aware color variation

# 

# An important visual detail is the relationship between blade deformation and color.

# 

# When a blade bends, its orientation changes. Its apparent brightness should change as well, because its surface is no longer oriented toward the light in the same way.

# 

# Using a full lighting calculation for every blade can be expensive at high densities. Instead, the grass shader incorporates a cheaper color adjustment associated with bending.

# 

# Bent blades become darker, helping suggest changes in illumination without requiring the same computational cost as a more elaborate lighting solution for every blade.

# 

# This is a deliberate balance between visual plausibility and performance.

# 

# \### Shadow strategy

# 

# The grass uses a selective shadow approach: environmental objects can cast shadows onto the grass, while the directional sunlight is not used to cast shadows across it.

# 

# This is both a performance consideration and a stylistic choice. Dense grass shadow maps can become expensive, and omitting directional-sun shadows also helps preserve the intended visual treatment.

# 

# The approach allows grass to participate in the environment's sense of depth without paying the full cost of shadowing every blade.

# 

# \### Grass optimization techniques

# 

# The grass system forms part of a wider optimization strategy:

# 

# \- GPU-side deformation rather than individual JavaScript animation of every blade.

# \- Noise-driven movement to create variation.

# \- Shader-based color adjustments associated with bending.

# \- Selective shadow handling.

# \- Instancing and batched rendering where appropriate.

# \- Distance-aware rendering and visibility management.

# \- Avoiding unnecessary per-blade CPU work and draw calls.

# 

# These techniques are intended to make dense vegetation practical while retaining the visual qualities that motivated the system.

# 

# \### Grass references

# 

# Two particularly useful references for the grass work are:

# 

# \- \[SimonDev — Procedural Grass](https://www.youtube.com/watch?v=bp7REZBV4P4)

# \- \[GDC: Advanced Graphics Summit — Procedural Grass](https://gdcvault.com/play/1027214/Advanced-Graphics-Summit-Procedural-Grass)

# 

# SimonDev has been a particularly valuable resource throughout development, especially for understanding procedural grass, shader-based animation, and performance-conscious rendering.

# 

# The GDC presentation provides additional insight into the challenges involved in rendering dense grass in a real-time game.

# 

# `\\\[Add rice-field inspiration video and grass shader screenshots here]`

# 

# \---

# 

# \## Shaders and Stylized Lighting

# 

# Custom shaders are used where the standard rendering pipeline does not provide the desired visual effect or where a specialized GPU-side implementation is more practical.

# 

# The intention is not to replace every built-in Three.js feature, but to use custom shader logic where it offers a clear visual or performance benefit.

# 

# \### Grass shader

# 

# The grass shader handles procedural bending, wind-driven motion, and color adjustments associated with deformation. It is designed to support high vegetation density without requiring a separate JavaScript animation loop for each blade.

# 

# \### God rays

# 

# The project also contains a `godRaysShader` experiment for stylized shafts of light.

# 

# This effect helps convey light passing through the environment, particularly around trees and their surrounding foliage.

# 

# The objective is to enhance atmosphere and make lighting an active part of the scene's composition rather than merely illuminating the models.

# 

# `\\\[Add screenshot showing light shafts around a tree]`

# 

# \### Stylized lighting and fog

# 

# Lighting and fog contribute significantly to the intended Ghibli-inspired atmosphere.

# 

# The environment has been developed through iterative adjustments to lighting, fog density, material response, and scene composition.

# 

# These choices are intended to make the world feel cohesive rather than simply combining realistic models with a stylized color palette.

# 

# \---

# 

# \## Noise and Procedural Generation

# 

# Noise is used throughout the project, not just for grass animation.

# 

# The project uses Perlin-style and Simplex noise techniques to introduce structured variation into procedural systems.

# 

# Noise provides a way to generate values that vary smoothly across space. This is useful when random placement alone would produce an environment that feels too uniform or visually chaotic.

# 

# Seeded pseudo-random number generation complements noise by making many procedural decisions reproducible.

# 

# \### Where noise is used

# 

# \#### TerrainSystem

# 

# Noise contributes to terrain height variation and the generation of natural-looking landscapes.

# 

# \#### PropDistributionSystem

# 

# Noise and seeded randomness help distribute environmental objects with variation, rather than placing them in perfectly regular patterns.

# 

# \#### WaterSystem

# 

# Noise contributes to the procedural variation used in the water system.

# 

# \#### SurfaceSystem

# 

# Noise can be used to introduce surface variation and help distinguish different areas of the environment.

# 

# \#### WorldGenerator

# 

# Noise and procedural generation contribute to the broader process of building a varied world from reusable rules.

# 

# The exact role of each noise function depends on the system using it. Noise is a building block rather than a complete world-generation algorithm: it must be combined with placement rules, terrain constraints, and other systems to create a convincing environment.

# 

# \---

# 

# \## Terrain Generation and Streaming

# 

# A procedural world needs more than a terrain-height function. It also needs a way to create, display, and unload terrain as the player moves through the environment.

# 

# Project Whimsical uses a chunk-based terrain architecture to organize the world into manageable regions.

# 

# \### Chunk-based terrain

# 

# Instead of treating the entire world as one enormous mesh, terrain is divided into chunks.

# 

# This provides a foundation for:

# 

# \- Generating terrain locally.

# \- Managing which regions are loaded.

# \- Applying different levels of detail at different distances.

# \- Spawning environmental objects in the appropriate regions.

# \- Unloading distant regions when they are no longer needed.

# 

# \### Terrain detail and LOD

# 

# Terrain detail is expensive when every region uses maximum resolution regardless of its distance from the player.

# 

# The terrain system therefore uses a distance-aware approach with multiple terrain resolutions. Nearby terrain can use finer detail, while more distant terrain can use coarser geometry.

# 

# The objective is to preserve detail where it matters most while controlling the amount of geometry that must be generated and rendered.

# 

# \### Faster terrain appearance

# 

# A major area of experimentation has been making terrain appear quickly as the player explores.

# 

# The architecture separates terrain creation from the broader process of managing the world. Worker-based processing has been explored in the project's terrain and procedural systems, with the aim of moving suitable calculations away from the main rendering thread.

# 

# The intended benefits include:

# 

# \- Reducing expensive synchronous work on the main thread.

# \- Generating terrain in manageable chunks.

# \- Supporting multiple terrain resolutions.

# \- Improving how new regions become available during exploration.

# 

# Worker-based generation does not eliminate all stalls by itself. Geometry creation, uploads, mesh construction, and other main-thread operations must still be managed carefully.

# 

# `\\\[Add video showing terrain generation, chunk loading, and streaming]`

# 

# \### Experimental quad-tree terrain

# 

# A quad-tree terrain approach is being explored as a future extension of the current chunk-based system.

# 

# The experiment is intended to support terrain that can adapt its spatial subdivision to the player's position and viewing distance, potentially enabling a much larger explorable area.

# 

# An experimental implementation is available in `TerrainGenBackUp/`. It is not yet the finalized terrain architecture.

# 

# \---

# 

# \## Procedural Vegetation and Prop Systems

# 

# A procedural environment needs a variety of objects to avoid looking repetitive.

# 

# Project Whimsical separates the placement and management of environmental objects into specialized systems. This makes it possible to develop different object types without putting every placement rule into one enormous world-generation function.

# 

# The systems include:

# 

# | System | Responsibility |

# |---|---|

# | `TreeSystem` | Tree models, placement, and tree-specific rendering behavior |

# | `RockSystem` | Rock models, placement, and LOD variants |

# | `BushSystem` | Bush placement and rendering |

# | `FlowerSystem` | Flower placement and rendering |

# | `GrassSystem` | Dense grass generation, animation, and rendering |

# | `PropDistributionSystem` | Procedural distribution of environmental props |

# | `PlacementRegistry` | Tracks placements and supports spatial checks between systems |

# 

# These systems work together to create a varied environment while respecting placement constraints and rendering budgets.

# 

# \### PlacementRegistry

# 

# Procedural placement must account for more than randomness.

# 

# Trees, rocks, bushes, flowers, and other objects should not overlap arbitrarily or occupy locations that violate the intended placement rules.

# 

# The `PlacementRegistry` provides a shared mechanism for tracking placements and checking whether a proposed location is blocked.

# 

# This allows different systems to coordinate their placement decisions rather than each system making decisions in complete isolation.

# 

# It also introduces its own performance considerations. Repeated spatial checks and unnecessary allocations can become expensive when many objects are generated, so the registry and its callers are important optimization targets.

# 

# \### Level of Detail

# 

# Level of Detail, or LOD, reduces the complexity of objects as their distance from the player increases.

# 

# A distant tree or rock generally does not need the same geometry and material complexity as an object directly in front of the camera.

# 

# The project experiments with object-specific LOD approaches, including simplified meshes and alternative representations at greater distances.

# 

# The precise implementation differs between systems. The goal is to preserve the overall silhouette and appearance of the environment while avoiding unnecessary detail on distant objects.

# 

# \### Shader application conditions

# 

# Custom materials and shaders can provide attractive results, but they may also introduce additional rendering work.

# 

# Where possible, shader effects should be applied only when they are needed. Distant or simplified objects may use cheaper materials or omit expensive effects, depending on the system.

# 

# This makes visual quality a distance-aware decision rather than an all-or-nothing setting.

# 

# \### Instancing and batching

# 

# Repeated objects are common in a natural environment. Trees, rocks, grass, and flowers may appear many times across the same region.

# 

# Instancing allows compatible objects to share geometry and material resources while varying their transforms and other supported attributes.

# 

# Batching can also reduce the number of individual draw calls where objects can be grouped appropriately.

# 

# These techniques are especially valuable when a scene contains many repeated objects, although they require careful handling of materials, visibility, and object-specific effects.

# 

# \### Culling

# 

# Not every object in the world needs to be rendered on every frame.

# 

# Project Whimsical uses visibility and distance-management techniques to reduce unnecessary work.

# 

# \- \*\*Frustum culling:\*\* avoids rendering objects outside the camera's view when supported by the relevant rendering path.

# \- \*\*Distance-based culling:\*\* removes or suppresses objects that are too far away to justify their rendering cost.

# \- \*\*Chunk-based management:\*\* organizes objects around loaded world regions.

# \- \*\*LOD switching:\*\* reduces complexity for objects that remain visible at greater distances.

# 

# Culling complements LOD: one determines whether an object needs to be rendered at all, while the other determines how much detail it should use when it is rendered.

# 

# \### Other optimization considerations

# 

# Additional areas of optimization include:

# 

# \- Reducing unnecessary draw calls.

# \- Reusing geometry and materials where possible.

# \- Avoiding redundant shader work.

# \- Minimizing allocations during procedural generation.

# \- Reducing repeated spatial lookups.

# \- Managing chunk creation and disposal.

# \- Separating generation logic from rendering where appropriate.

# \- Avoiding unnecessary processing for distant or inactive objects.

# 

# No single technique solves every performance problem. The goal is to make each subsystem efficient enough to contribute to the larger world without dominating the frame time.

# 

# `\\\[Add Blender viewport images and in-game screenshots for trees, rocks, bushes, and flowers]`

# 

# \---

# 

# \## World Generation and Chunk Management

# 

# The environment is the result of multiple specialized systems working together, rather than a single function that creates everything.

# 

# At a high level, the process is organized around terrain generation, procedural placement, rendering decisions, and chunk management.

# 

# \### ChunkManager

# 

# The `ChunkManager` coordinates which terrain chunks are active around the player.

# 

# It tracks loaded chunks, determines which regions should be present based on the player's position and the configured loading range, and manages the creation and removal of chunk-related resources.

# 

# Each chunk can contain terrain and associated environmental systems.

# 

# \### How the systems fit together

# 

# The following diagram illustrates the intended high-level relationship between the systems.

# 

# ```mermaid

# flowchart TD

# &#x20;   A\[Player Position] --> B\[ChunkManager]

# &#x20;   B --> C\[Determine Required Chunks]

# &#x20;   C --> D\[TerrainSystem]

# &#x20;   C --> E\[PropDistributionSystem]

# &#x20;   D --> F\[Terrain Mesh and LOD]

# &#x20;   E --> G\[PlacementRegistry]

# &#x20;   G --> H\[TreeSystem]

# &#x20;   G --> I\[RockSystem]

# &#x20;   G --> J\[BushSystem]

# &#x20;   G --> K\[FlowerSystem]

# &#x20;   E --> L\[GrassSystem]

# &#x20;   D --> M\[WaterSystem and SurfaceSystem]

# &#x20;   F --> N\[Scene Rendering]

# &#x20;   H --> N

# &#x20;   I --> N

# &#x20;   J --> N

# &#x20;   K --> N

# &#x20;   L --> N

# &#x20;   M --> N

# ```

# 

# This is a conceptual overview of the system relationships, not a complete representation of every dependency or call sequence.

# 

# The important idea is that chunk management coordinates the environment, while specialized systems remain responsible for their own generation and rendering behavior.

# 

# As the player moves, the world manager updates the required regions, and the associated systems supply the terrain and props needed to represent those regions.

# 

# This separation makes it easier to experiment with terrain generation, vegetation, LOD, and optimization without rewriting the entire world pipeline.

# 

# \---

# 

# \## Movement System

# 

# Movement is another area where the project has evolved beyond a basic first-person controller.

# 

# The goal is to make traversal feel responsive and expressive while remaining compatible with the terrain and environment.

# 

# \### Current movement features

# 

# The custom first-person movement controller has been developed around features including:

# 

# \- Walking and directional movement.

# \- Sprinting.

# \- Dashing.

# \- Jumping and double jumping.

# \- Airborne dash experimentation.

# \- Gravity and terrain-height interaction.

# \- Camera movement and motion feedback.

# 

# The controller also explores presentation details such as walking and sprinting bob, jump anticipation, and dash lean.

# 

# \### Inspiration

# 

# The movement direction draws inspiration from the fluidity and responsiveness of movement systems found in games such as Cyberpunk 2077.

# 

# The aim is to make traversal feel more expressive than simply moving a camera through a scene. Sprinting, jumping, and dashing should work together as parts of a coherent movement system.

# 

# These features are still being refined, and the final movement model may change as the game's scale and gameplay requirements evolve.

# 

# \---

# 

# \## Performance Debugging and Optimization

# 

# Performance is a recurring concern because the game combines dense vegetation, procedural geometry, custom shaders, terrain streaming, and large numbers of environmental props.

# 

# Rather than relying solely on how the game feels while running, the project includes a performance-debugging workflow to help identify expensive systems.

# 

# \### Performance Debugger

# 

# The project's Performance Debugger is used to inspect the state of the environment and investigate performance bottlenecks.

# 

# Depending on the active instrumentation, it can help examine:

# 

# \- Frame rate and frame-time behavior.

# \- Draw calls and rendering workload.

# \- Loaded chunks and world activity.

# \- Prop counts and system-level behavior.

# \- Visibility and object distribution.

# \- The effects of enabling or disabling individual systems.

# \- The impact of despawning specific prop types during experiments.

# \- Diagnostic logs that can be reviewed after a test.

# 

# The ability to despawn props selectively is particularly useful: it helps isolate whether a performance problem is associated with a particular category of objects rather than the environment as a whole.

# 

# The debugger's exact readings depend on the instrumentation enabled in the current build.

# 

# \### Browser profiling

# 

# The built-in Google Chrome DevTools Performance panel is another important part of the workflow.

# 

# It can help identify:

# 

# \- Long-running JavaScript tasks.

# \- Main-thread stalls.

# \- Expensive function calls.

# \- Garbage-collection activity.

# \- Frame-time spikes.

# \- Work associated with rendering and procedural generation.

# 

# Combining game-specific instrumentation with browser profiling makes it easier to distinguish CPU-side bottlenecks from GPU or rendering-related costs.

# 

# \### The optimization workflow

# 

# The general approach is iterative:

# 

# 1\. Establish a baseline.

# 2\. Reproduce a performance issue.

# 3\. Use the debugger and browser profiling tools to narrow down the cause.

# 4\. Change one relevant subsystem or rendering technique.

# 5\. Repeat the same test.

# 6\. Compare the results and check for regressions.

# 

# This is particularly important for procedural worlds because an optimization that helps one system may introduce costs elsewhere.

# 

# The long-term objective is to build a world that remains responsive as terrain, vegetation, and environmental complexity increase.

# 

# \---

# 

# \## Future Roadmap

# 

# The following roadmap distinguishes existing work from ideas that are still experimental or conceptual. These are intended directions, not promises about release dates.

# 

# \### Terrain and world scale

# 

# \- \[ ] \*\*Quad-tree terrain system:\*\* Continue experimenting with adaptive terrain subdivision, with a long-term target of supporting exploration across areas approaching 2 km. The experimental work is in `TerrainGenBackUp/`.

# \- \[ ] \*\*Water streams:\*\* Develop procedural streams that connect to larger water basins. The basins are already implemented; the connecting stream system remains conceptual.

# \- \[ ] \*\*Procedural paths:\*\* Generate paths that guide players toward points of interest. This remains a concept.

# 

# \### Gameplay systems

# 

# \- \[ ] \*\*Procedural mobs:\*\* Introduce procedurally generated or distributed creatures and other inhabitants. No implementation progress yet.

# \- \[ ] \*\*Procedural narrative:\*\* Explore systems for generating environmental stories, events, or other narrative elements. The direction remains undecided, with no implementation progress yet.

# \- \[ ] \*\*Combat system:\*\* Design and implement a combat system.

# \- \[ ] \*\*Inventory system:\*\* Introduce item collection and inventory management.

# \- \[ ] \*\*Economy:\*\* Develop the world's economy and resource interactions.

# \- \[ ] \*\*Gathering and survival:\*\* Expand the current MVP into a more complete gathering-and-survival gameplay loop.

# 

# \### Experimental input systems

# 

# \- \[ ] \*\*Gesture-based controls:\*\* Evaluate whether gesture input fits the final game. A working prototype exists in `gesture-controls/`, including a light ball triggered by snapping fingers and a fireball triggered by opening the palm.

# 

# \### Rendering and optimization

# 

# \- \[ ] Continue improving terrain streaming and chunk transitions.

# \- \[ ] Refine LOD selection and object visibility management.

# \- \[ ] Improve vegetation density and rendering efficiency.

# \- \[ ] Continue profiling CPU and GPU workloads as the world becomes more complex.

# \- \[ ] Refine atmospheric effects and stylized lighting.

# \- \[ ] Improve the integration between world generation, movement, and gameplay.

# 

# \---

# 

# \## Inspiration and References

# 

# Project Whimsical draws from several sources of visual and technical inspiration.

# 

# \### Visual inspiration

# 

# \- \*\*Studio Ghibli:\*\* The cozy atmosphere, natural environments, expressive lighting, and sense of wonder found in Ghibli-inspired worlds.

# \- \*\*The Legend of Zelda:\*\* The sense of adventure and exploration associated with stylized fantasy environments.

# 

# These are sources of inspiration rather than claims of affiliation or endorsement.

# 

# \### Technical references

# 

# \*\*SimonDev\*\*

# 

# \[Procedural Grass — YouTube](https://www.youtube.com/watch?v=bp7REZBV4P4)

# 

# A particularly valuable resource throughout the grass-rendering and shader-development process.

# 

# \*\*GDC — Advanced Graphics Summit: Procedural Grass\*\*

# 

# \[Watch the GDC presentation](https://gdcvault.com/play/1027214/Advanced-Graphics-Summit-Procedural-Grass)

# 

# A technical reference for understanding the challenges of rendering dense procedural vegetation in real-time environments.

# 

# These resources helped inform the project's exploration of GPU-side animation, vegetation rendering, and the trade-offs involved in producing detailed environments efficiently.

# 

# \---

# 

# \## Contributing

# 

# Project Whimsical is an ongoing learning and development project.

# 

# If you are interested in procedural generation, Three.js, shader programming, terrain systems, stylized rendering, or game optimization, contributions and constructive feedback are welcome.

# 

# Before proposing large architectural changes, please consider the existing systems and their interactions. The project is built around specialized terrain, placement, vegetation, movement, and chunk-management components, and preserving those boundaries is important.

# 

# For changes involving performance, measurements and reproducible test cases are especially helpful.

# 

# \### Suggested contribution workflow

# 

# 1\. Fork the repository.

# 2\. Create a branch for your changes.

# 3\. Make focused changes that preserve existing system responsibilities.

# 4\. Test the game and inspect the browser console.

# 5\. Profile performance-sensitive changes where appropriate.

# 6\. Submit a pull request describing the change and its impact.

# 

# \---

# 

# \## License and Asset Usage

# 

# \### Source code

# 

# The project's source code is intended to be released under the MIT License, subject to the terms in the repository's `LICENSE` file.

# 

# The MIT License permits broad use of covered code, including commercial use, subject to its conditions.

# 

# \### 3D models and other art assets

# 

# \*\*The project's 3D models and designated art assets are not automatically covered by the source-code license.\*\*

# 

# Unless otherwise stated or separately authorized, the models distributed through the external asset download are not licensed for commercial use. Please obtain prior permission from the relevant rights holder before using them in a commercial project.

# 

# Do not assume that permission to use the source code grants permission to redistribute, sell, modify for commercial use, or incorporate the artwork into a commercial product.

# 

# For clarity, the repository should include a separate `ASSETS-LICENSE.md` identifying the assets covered by these restrictions. The README and asset archive should also clearly identify the applicable terms.

# 

# Third-party libraries, references, and assets remain subject to their own respective licenses and terms.

# 

# If you are interested in using an asset commercially, please contact the project maintainer to discuss permission.

# 

# \---

# 

# \*Project Whimsical is a work in progress. The systems, visuals, architecture, and roadmap described here may change as development continues.\*

