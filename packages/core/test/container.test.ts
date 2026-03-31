import { describe, expect, it } from 'vitest'
import { DIContainer, ServiceTokens } from '../src/container'

describe('DIContainer', () => {
	it('should register and resolve a service', () => {
		const container = new DIContainer()
		const service = { name: 'test' }
		container.register('test', service)
		expect(container.resolve('test')).toBe(service)
	})

	it('should register and resolve via factory', () => {
		const container = new DIContainer()
		container.registerFactory('factory', () => ({ created: true }))
		const result = container.resolve('factory')
		expect(result).toEqual({ created: true })
	})

	it('should throw when service not found', () => {
		const container = new DIContainer()
		expect(() => container.resolve('missing')).toThrow('Service not found')
	})

	it('should check if service exists', () => {
		const container = new DIContainer()
		container.register('present', {})
		expect(container.has('present')).toBe(true)
		expect(container.has('missing')).toBe(false)
	})

	it('should check if factory exists', () => {
		const container = new DIContainer()
		container.registerFactory('factory', () => ({}))
		expect(container.has('factory')).toBe(true)
	})

	it('should create child container with copied services', () => {
		const parent = new DIContainer()
		parent.register('shared', { value: 1 })
		const child = parent.createChild()
		expect(child.resolve('shared')).toEqual({ value: 1 })
	})

	it('should resolve ServiceTokens', () => {
		const container = new DIContainer()
		container.register(ServiceTokens.Logger, { info: () => {} })
		container.register(ServiceTokens.Serializer, {
			serialize: () => '',
			deserialize: () => ({}),
		})
		container.register(ServiceTokens.Evaluator, { evaluate: () => null })
		container.register(ServiceTokens.EventBus, { emit: async () => {} })
		container.register(ServiceTokens.Middleware, [])
		container.register(ServiceTokens.NodeRegistry, {})
		container.register(ServiceTokens.BlueprintRegistry, {})
		container.register(ServiceTokens.Dependencies, {})

		expect(container.resolve(ServiceTokens.Logger)).toBeDefined()
		expect(container.resolve(ServiceTokens.Serializer)).toBeDefined()
		expect(container.resolve(ServiceTokens.Evaluator)).toBeDefined()
		expect(container.resolve(ServiceTokens.EventBus)).toBeDefined()
		expect(container.resolve(ServiceTokens.Middleware)).toEqual([])
		expect(container.resolve(ServiceTokens.NodeRegistry)).toEqual({})
		expect(container.resolve(ServiceTokens.BlueprintRegistry)).toEqual({})
		expect(container.resolve(ServiceTokens.Dependencies)).toEqual({})
	})
})
