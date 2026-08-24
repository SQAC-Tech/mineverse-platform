import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Nothing here is a micro-optimisation for its own sake — each line is
   * either bandwidth off the free hosting plan or a header we do not need.
   */

  // One header on every response, on every request, for no benefit.
  poweredByHeader: false,

  /**
   * Tree-shake the barrel files.
   *
   * `lucide-react` is on Next's built-in list already, so it is deliberately
   * not repeated here. These two are not: `@base-ui/react` and drei both
   * re-export very large module graphs from a single entry point, and the
   * landing page pulls drei in eagerly alongside three.js.
   */
  experimental: {
    optimizePackageImports: ["@base-ui/react", "@react-three/drei"],
  },
};

export default nextConfig;
