import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as net from 'net';

// Use function declaration to ensure it's a valid constructor
vi.mock('net', () => {
  function MockSocket(this: any) {
    this.connect = vi.fn().mockImplementation((p, h, cb) => {
      if (cb) setTimeout(cb, 0);
      return this;
    });
    this.write = vi.fn();
    this.on = vi.fn().mockReturnThis();
    this.setTimeout = vi.fn().mockReturnThis();
    this.setKeepAlive = vi.fn().mockReturnThis();
    this.destroy = vi.fn();
    this.end = vi.fn();
    this.removeAllListeners = vi.fn().mockReturnThis();
    if ((MockSocket as any).instances) {
      (MockSocket as any).instances.push(this);
    }
  }
  (MockSocket as any).instances = [];
  return { Socket: MockSocket };
});

import { XMRStratumClient } from '../src/XMRStratumClient';
import { BTCStratumClient } from '../src/BTCStratumClient';

describe('Stratum Connectivity & Protocol', () => {
  beforeEach(() => {
    (net.Socket as any).instances = [];
    vi.clearAllMocks();
  });

  describe('XMRStratumClient', () => {
    it('should connect and login with XMR protocol', async () => {
      const client = new XMRStratumClient('host', 1234);
      client.connect();
      client.login('wallet', 'pass');

      const socket = (net.Socket as any).instances[0];
      expect(socket.connect).toHaveBeenCalled();
      expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('"method":"login"'));
    });
  });

  describe('BTCStratumClient', () => {
    it('should connect and authorize with mining.authorize (BTC/Alt)', async () => {
      const client = new BTCStratumClient('host', 443);
      client.connect();

      // Wait for the internal auto-subscribe call in connect()
      await new Promise(r => setTimeout(r, 10));

      client.authorize('user', 'pass');

      const socket = (net.Socket as any).instances[0];
      expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('"method":"mining.subscribe"'));
      expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('"method":"mining.authorize"'));
    });
  });
});
