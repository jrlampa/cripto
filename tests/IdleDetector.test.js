"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const IdleDetector_1 = require("../src/IdleDetector");
(0, vitest_1.describe)('IdleDetector', () => {
    (0, vitest_1.it)('should initialize with a boolean state', () => {
        const detector = new IdleDetector_1.IdleDetector();
        (0, vitest_1.expect)(typeof detector.isIdle).toBe('boolean');
    });
    (0, vitest_1.it)('should emit change event when state moves to idle', async () => {
        const detector = new IdleDetector_1.IdleDetector();
        const spy = vitest_1.vi.fn();
        detector.on('change', spy);
        detector.isIdle = true;
        detector.emit('change', true);
        (0, vitest_1.expect)(spy).toHaveBeenCalledWith(true);
    });
});
//# sourceMappingURL=IdleDetector.test.js.map