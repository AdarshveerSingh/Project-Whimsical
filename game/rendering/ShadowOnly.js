export function applyShadowOnly(material, shadowDarkness = 0.45) {

    const previousOnBeforeCompile = material.onBeforeCompile;

    material.onBeforeCompile = (shader, renderer) => {

        // run any earlier patch first (e.g. the wind shader)
        previousOnBeforeCompile.call(material, shader, renderer);

        shader.uniforms.shadowDarkness = { value: shadowDarkness };
        material.userData.shader = shader;

        shader.fragmentShader =
            "uniform float shadowDarkness;\n" + shader.fragmentShader;

        // Only add getShadowMask() if the material doesn't already include it
        if (!shader.fragmentShader.includes("#include <shadowmask_pars_fragment>")) {
            shader.fragmentShader = shader.fragmentShader.replace(
                "#include <shadowmap_pars_fragment>",
                `
                #include <shadowmap_pars_fragment>
                #include <shadowmask_pars_fragment>
                `
            );
        }

        const opaqueChunk =
            shader.fragmentShader.includes("#include <opaque_fragment>")
                ? "#include <opaque_fragment>"
                : "#include <output_fragment>"; // older three.js

        shader.fragmentShader = shader.fragmentShader.replace(
            opaqueChunk,
            `
            // 1.0 = lit, 0.0 = shadowed
            float shadowMask = getShadowMask();

            // No scene lighting: just the texture color, darkened in shadow
            outgoingLight = diffuseColor.rgb *
                mix(vec3(shadowDarkness), vec3(1.0), shadowMask);

            ${opaqueChunk}
            `
        );
    };

    material.needsUpdate = true;
}