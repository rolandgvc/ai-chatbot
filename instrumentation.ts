import { registerOTel } from '@vercel/otel';
import { IntrospectionSpanProcessor } from '@introspection-sdk/introspection-node';

export function register() {
  registerOTel({
    serviceName: 'ai-chatbot',
    spanProcessors: [
      new IntrospectionSpanProcessor({
        token: process.env.INTROSPECTION_TOKEN,
      }),
    ],
  });
}
