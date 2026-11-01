// Lets Node run the game's TypeScript directly (scripts/, e.g. `pnpm sim:run`): the source
// imports `./World` the way Vite expects, so try `.ts` / `/index.ts` when a relative import has no extension.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (!/^\.{1,2}\//.test(specifier) || /\.[cm]?[jt]sx?$/.test(specifier)) throw err;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try {
          return nextResolve(candidate, context);
        } catch {
          // try the next candidate
        }
      }
      throw err;
    }
  },
});
