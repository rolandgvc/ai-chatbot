import { IntrospectionSpanProcessor } from '@introspection-sdk/introspection-node';
import { registerOTel } from '@vercel/otel';

export function register() {
  const introspectionSpanProcessor = new IntrospectionSpanProcessor({
    token: process.env.INTROSPECTION_TOKEN,
  });

  registerOTel({
    serviceName: 'ai-chatbot',
    spanProcessors: [introspectionSpanProcessor],
  });
}
