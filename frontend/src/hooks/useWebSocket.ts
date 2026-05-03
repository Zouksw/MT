"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:8000";

interface UseWebSocketOptions {
	onConnect?: () => void;
	onDisconnect?: () => void;
	onError?: (err: Error) => void;
	autoConnect?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
	const { onConnect, onDisconnect, onError, autoConnect = true } = options;
	const socketRef = useRef<Socket | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const reconnectAttempts = useRef(0);

	const connect = useCallback(() => {
		if (socketRef.current?.connected) return;

		const socket = io(WS_URL, {
			transports: ["websocket", "polling"],
			reconnection: true,
			reconnectionAttempts: 10,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 30000,
		});

		socket.on("connect", () => {
			setIsConnected(true);
			reconnectAttempts.current = 0;
			onConnect?.();
		});

		socket.on("disconnect", () => {
			setIsConnected(false);
			onDisconnect?.();
		});

		socket.on("connect_error", (err) => {
			reconnectAttempts.current++;
			onError?.(err);
		});

		socketRef.current = socket;
	}, [onConnect, onDisconnect, onError]);

	const disconnect = useCallback(() => {
		socketRef.current?.disconnect();
		socketRef.current = null;
		setIsConnected(false);
	}, []);

	const subscribe = useCallback((room: string) => {
		socketRef.current?.emit("subscribe", room);
	}, []);

	const unsubscribe = useCallback((room: string) => {
		socketRef.current?.emit("unsubscribe", room);
	}, []);

	const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
		socketRef.current?.on(event, handler);
		return () => {
			socketRef.current?.off(event, handler);
		};
	}, []);

	useEffect(() => {
		if (autoConnect) connect();
		return () => {
			disconnect();
		};
	}, [autoConnect, connect, disconnect]);

	return {
		isConnected,
		subscribe,
		unsubscribe,
		on,
		connect,
		disconnect,
	};
}
