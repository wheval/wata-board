import {
  isConnected as freighterIsConnected,
  requestAccess as freighterRequestAccess,
  signTransaction as freighterSignTransaction,
} from '@stellar/freighter-api';

export async function isConnected(): Promise<{ isConnected: boolean }> {
  console.log('[WalletBridge] isConnected called');
  try {
    const freighter = (window as any).freighter;
    if (freighter) {
      console.log('[WalletBridge] freighter detected on window');
      return { isConnected: true };
    }
    const result = await freighterIsConnected();
    console.log('[WalletBridge] freighterIsConnected result:', JSON.stringify(result));
    if (typeof result === 'boolean') return { isConnected: result };
    if (result && typeof result === 'object' && 'isConnected' in result) return { isConnected: (result as any).isConnected };
    return { isConnected: true };
  } catch (e) {
    console.error('[WalletBridge] isConnected error:', e);
    return { isConnected: true };
  }
}

export async function requestAccess(): Promise<{ address: string; error?: string }> {
  try {
    const result = await freighterRequestAccess();
    console.log('[WalletBridge] requestAccess result:', JSON.stringify(result));
    if (typeof result === 'string') return { address: result };
    if (result && typeof result === 'object') {
      const address = ((result as any).address || (result as any).publicKey || '').trim();
      return { address, error: (result as any).error };
    }
    return { address: '', error: 'Unknown error' };
  } catch (e: any) {
    return { address: '', error: e.message };
  }
}

export async function signTransaction(xdr: string, network?: string): Promise<{ signedTxXdr: string; error?: string }> {
  try {
    const result = await freighterSignTransaction(xdr, { networkPassphrase: network });
    return { signedTxXdr: result.signedTxXdr, error: (result as any).error };
  } catch (e: any) {
    return { signedTxXdr: '', error: e.message };
  }
}
