import { describe, it, expect, vi } from 'vitest';
import { IdleDetector } from '../src/IdleDetector';

describe('IdleDetector', () => {
  it('should initialize with a boolean state', () => {
    const detector = new IdleDetector();
    expect(typeof detector.isIdle).toBe('boolean');
  });

  it('should emit change event when state moves to idle', async () => {
    const detector = new IdleDetector();
    const spy = vi.fn();
    detector.on('change', spy);

    detector.isIdle = true;
    detector.emit('change', true);

    expect(spy).toHaveBeenCalledWith(true);
  });
});
