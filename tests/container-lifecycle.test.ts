import { describe, it, expect, beforeEach } from 'vitest'

// Mock contract state
const mockContractState = {
  containers: new Map(),
  containerHistory: new Map(),
  totalContainers: 0,
  nextEventId: 0
}

// Container states
const STATES = {
  MANUFACTURED: 0,
  DISTRIBUTED: 1,
  IN_USE: 2,
  COLLECTED: 3,
  RECYCLED: 4,
  DISPOSED: 5
}

// Mock contract functions
const contractFunctions = {
  createContainer: (containerId, materialType, carbonFootprint, sender) => {
    if (mockContractState.containers.has(containerId)) {
      return { error: 'ERR_ALREADY_EXISTS' }
    }
    
    const container = {
      manufacturer: sender,
      materialType,
      currentState: STATES.MANUFACTURED,
      createdAt: Date.now(),
      currentOwner: null,
      recyclingCount: 0,
      carbonFootprint
    }
    
    mockContractState.containers.set(containerId, container)
    
    // Add initial event
    const eventId = mockContractState.nextEventId++
    mockContractState.containerHistory.set(`${containerId}-${eventId}`, {
      previousState: STATES.MANUFACTURED,
      newState: STATES.MANUFACTURED,
      actor: sender,
      timestamp: Date.now(),
      location: 'Factory'
    })
    
    mockContractState.totalContainers++
    return { success: containerId }
  },
  
  updateContainerState: (containerId, newState, location, sender) => {
    const container = mockContractState.containers.get(containerId)
    if (!container) {
      return { error: 'ERR_NOT_FOUND' }
    }
    
    const currentState = container.currentState
    if (!isValidStateTransition(currentState, newState)) {
      return { error: 'ERR_INVALID_STATE' }
    }
    
    container.currentState = newState
    
    // Add event
    const eventId = mockContractState.nextEventId++
    mockContractState.containerHistory.set(`${containerId}-${eventId}`, {
      previousState: currentState,
      newState,
      actor: sender,
      timestamp: Date.now(),
      location
    })
    
    return { success: true }
  },
  
  transferContainer: (containerId, newOwner, sender) => {
    const container = mockContractState.containers.get(containerId)
    if (!container) {
      return { error: 'ERR_NOT_FOUND' }
    }
    
    container.currentOwner = newOwner
    return { success: true }
  },
  
  recycleContainer: (containerId, sender) => {
    const container = mockContractState.containers.get(containerId)
    if (!container) {
      return { error: 'ERR_NOT_FOUND' }
    }
    
    if (container.currentState !== STATES.COLLECTED) {
      return { error: 'ERR_INVALID_STATE' }
    }
    
    container.currentState = STATES.RECYCLED
    container.recyclingCount++
    
    // Add event
    const eventId = mockContractState.nextEventId++
    mockContractState.containerHistory.set(`${containerId}-${eventId}`, {
      previousState: STATES.COLLECTED,
      newState: STATES.RECYCLED,
      actor: sender,
      timestamp: Date.now(),
      location: 'Recycling Facility'
    })
    
    return { success: true }
  },
  
  getContainer: (containerId) => {
    return mockContractState.containers.get(containerId) || null
  },
  
  getContainerEvent: (containerId, eventId) => {
    return mockContractState.containerHistory.get(`${containerId}-${eventId}`) || null
  },
  
  getTotalContainers: () => {
    return mockContractState.totalContainers
  }
}

// Helper function for state transitions
function isValidStateTransition(currentState, newState) {
  const validTransitions = {
    [STATES.MANUFACTURED]: [STATES.DISTRIBUTED],
    [STATES.DISTRIBUTED]: [STATES.IN_USE],
    [STATES.IN_USE]: [STATES.COLLECTED],
    [STATES.COLLECTED]: [STATES.RECYCLED, STATES.DISPOSED],
    [STATES.RECYCLED]: [STATES.DISTRIBUTED]
  }
  
  return validTransitions[currentState]?.includes(newState) || false
}

describe('Container Lifecycle Contract', () => {
  beforeEach(() => {
    // Reset contract state before each test
    mockContractState.containers.clear()
    mockContractState.containerHistory.clear()
    mockContractState.totalContainers = 0
    mockContractState.nextEventId = 0
  })
  
  describe('Container Creation', () => {
    it('should create a new container successfully', () => {
      const result = contractFunctions.createContainer(
          'ECO-001',
          'biodegradable-plastic',
          50,
          'manufacturer-1'
      )
      
      expect(result.success).toBe('ECO-001')
      expect(mockContractState.totalContainers).toBe(1)
      
      const container = contractFunctions.getContainer('ECO-001')
      expect(container.manufacturer).toBe('manufacturer-1')
      expect(container.materialType).toBe('biodegradable-plastic')
      expect(container.currentState).toBe(STATES.MANUFACTURED)
      expect(container.carbonFootprint).toBe(50)
      expect(container.recyclingCount).toBe(0)
    })
    
    it('should prevent duplicate container creation', () => {
      contractFunctions.createContainer('ECO-001', 'plastic', 50, 'manufacturer-1')
      
      const result = contractFunctions.createContainer(
          'ECO-001',
          'glass',
          30,
          'manufacturer-2'
      )
      
      expect(result.error).toBe('ERR_ALREADY_EXISTS')
      expect(mockContractState.totalContainers).toBe(1)
    })
    
    it('should create initial event on container creation', () => {
      contractFunctions.createContainer('ECO-001', 'plastic', 50, 'manufacturer-1')
      
      const event = contractFunctions.getContainerEvent('ECO-001', 0)
      expect(event.previousState).toBe(STATES.MANUFACTURED)
      expect(event.newState).toBe(STATES.MANUFACTURED)
      expect(event.actor).toBe('manufacturer-1')
      expect(event.location).toBe('Factory')
    })
  })
  
  describe('State Transitions', () => {
    beforeEach(() => {
      contractFunctions.createContainer('ECO-001', 'plastic', 50, 'manufacturer-1')
    })
    
    it('should allow valid state transitions', () => {
      // MANUFACTURED -> DISTRIBUTED
      let result = contractFunctions.updateContainerState(
          'ECO-001',
          STATES.DISTRIBUTED,
          'Distribution Center',
          'distributor-1'
      )
      expect(result.success).toBe(true)
      
      let container = contractFunctions.getContainer('ECO-001')
      expect(container.currentState).toBe(STATES.DISTRIBUTED)
      
      // DISTRIBUTED -> IN_USE
      result = contractFunctions.updateContainerState(
          'ECO-001',
          STATES.IN_USE,
          'Consumer Location',
          'consumer-1'
      )
      expect(result.success).toBe(true)
      
      container = contractFunctions.getContainer('ECO-001')
      expect(container.currentState).toBe(STATES.IN_USE)
    })
    
    it('should reject invalid state transitions', () => {
      // Try to go directly from MANUFACTURED to IN_USE (skipping DISTRIBUTED)
      const result = contractFunctions.updateContainerState(
          'ECO-001',
          STATES.IN_USE,
          'Consumer Location',
          'consumer-1'
      )
      
      expect(result.error).toBe('ERR_INVALID_STATE')
      
      const container = contractFunctions.getContainer('ECO-001')
      expect(container.currentState).toBe(STATES.MANUFACTURED) // Should remain unchanged
    })
    
    it('should handle complete lifecycle', () => {
      const transitions = [
        { state: STATES.DISTRIBUTED, location: 'Distribution Center' },
        { state: STATES.IN_USE, location: 'Consumer Location' },
        { state: STATES.COLLECTED, location: 'Collection Point' },
        { state: STATES.RECYCLED, location: 'Recycling Facility' }
      ]
      
      transitions.forEach((transition, index) => {
        const result = contractFunctions.updateContainerState(
            'ECO-001',
            transition.state,
            transition.location,
            `actor-${index}`
        )
        expect(result.success).toBe(true)
      })
      
      const container = contractFunctions.getContainer('ECO-001')
      expect(container.currentState).toBe(STATES.RECYCLED)
    })
    
    it('should allow recycled containers to be redistributed', () => {
      // Complete initial lifecycle
      const transitions = [
        STATES.DISTRIBUTED,
        STATES.IN_USE,
        STATES.COLLECTED,
        STATES.RECYCLED
      ]
      
      transitions.forEach(state => {
        contractFunctions.updateContainerState('ECO-001', state, 'Location', 'actor')
      })
      
      // Now redistribute
      const result = contractFunctions.updateContainerState(
          'ECO-001',
          STATES.DISTRIBUTED,
          'New Distribution Center',
          'distributor-2'
      )
      
      expect(result.success).toBe(true)
      
      const container = contractFunctions.getContainer('ECO-001')
      expect(container.currentState).toBe(STATES.DISTRIBUTED)
    })
  })
  
  describe('Container Transfer', () => {
    beforeEach(() => {
      contractFunctions.createContainer('ECO-001', 'plastic', 50, 'manufacturer-1')
    })
    
    it('should transfer container ownership', () => {
      const result = contractFunctions.transferContainer('ECO-001', 'new-owner', 'current-owner')
      
      expect(result.success).toBe(true)
      
      const container = contractFunctions.getContainer('ECO-001')
      expect(container.currentOwner).toBe('new-owner')
    })
    
    it('should handle transfer of non-existent container', () => {
      const result = contractFunctions.transferContainer('NON-EXISTENT', 'new-owner', 'current-owner')
      
      expect(result.error).toBe('ERR_NOT_FOUND')
    })
  })
  
  describe('Container Recycling', () => {
    beforeEach(() => {
      contractFunctions.createContainer('ECO-001', 'plastic', 50, 'manufacturer-1')
      // Move to collected state
      contractFunctions.updateContainerState('ECO-001', STATES.DISTRIBUTED, 'Dist', 'actor')
      contractFunctions.updateContainerState('ECO-001', STATES.IN_USE, 'Consumer', 'actor')
      contractFunctions.updateContainerState('ECO-001', STATES.COLLECTED, 'Collection', 'actor')
    })
    
    it('should recycle container from collected state', () => {
      const result = contractFunctions.recycleContainer('ECO-001', 'recycler-1')
      
      expect(result.success).toBe(true)
      
      const container = contractFunctions.getContainer('ECO-001')
      expect(container.currentState).toBe(STATES.RECYCLED)
      expect(container.recyclingCount).toBe(1)
    })
    
    it('should reject recycling from invalid state', () => {
      // Reset to manufactured state
      const container = mockContractState.containers.get('ECO-001')
      container.currentState = STATES.MANUFACTURED
      
      const result = contractFunctions.recycleContainer('ECO-001', 'recycler-1')
      
      expect(result.error).toBe('ERR_INVALID_STATE')
    })
    
    it('should increment recycling count on multiple recycles', () => {
      // First recycle
      contractFunctions.recycleContainer('ECO-001', 'recycler-1')
      
      // Redistribute and recycle again
      contractFunctions.updateContainerState('ECO-001', STATES.DISTRIBUTED, 'Dist', 'actor')
      contractFunctions.updateContainerState('ECO-001', STATES.IN_USE, 'Consumer', 'actor')
      contractFunctions.updateContainerState('ECO-001', STATES.COLLECTED, 'Collection', 'actor')
      contractFunctions.recycleContainer('ECO-001', 'recycler-1')
      
      const container = contractFunctions.getContainer('ECO-001')
      expect(container.recyclingCount).toBe(2)
    })
  })
  
  describe('Event History', () => {
    beforeEach(() => {
      contractFunctions.createContainer('ECO-001', 'plastic', 50, 'manufacturer-1')
    })
    
    it('should track all state changes', () => {
      contractFunctions.updateContainerState('ECO-001', STATES.DISTRIBUTED, 'Warehouse', 'distributor')
      contractFunctions.updateContainerState('ECO-001', STATES.IN_USE, 'Store', 'consumer')
      
      // Check creation event
      const event0 = contractFunctions.getContainerEvent('ECO-001', 0)
      expect(event0.newState).toBe(STATES.MANUFACTURED)
      expect(event0.location).toBe('Factory')
      
      // Check distribution event
      const event1 = contractFunctions.getContainerEvent('ECO-001', 1)
      expect(event1.previousState).toBe(STATES.MANUFACTURED)
      expect(event1.newState).toBe(STATES.DISTRIBUTED)
      expect(event1.location).toBe('Warehouse')
      expect(event1.actor).toBe('distributor')
      
      // Check in-use event
      const event2 = contractFunctions.getContainerEvent('ECO-001', 2)
      expect(event2.previousState).toBe(STATES.DISTRIBUTED)
      expect(event2.newState).toBe(STATES.IN_USE)
      expect(event2.location).toBe('Store')
      expect(event2.actor).toBe('consumer')
    })
    
    it('should return null for non-existent events', () => {
      const event = contractFunctions.getContainerEvent('ECO-001', 999)
      expect(event).toBe(null)
    })
    
    it('should return null for events of non-existent containers', () => {
      const event = contractFunctions.getContainerEvent('NON-EXISTENT', 0)
      expect(event).toBe(null)
    })
  })
  
  describe('Data Retrieval', () => {
    it('should return null for non-existent container', () => {
      const container = contractFunctions.getContainer('NON-EXISTENT')
      expect(container).toBe(null)
    })
    
    it('should track total containers correctly', () => {
      expect(contractFunctions.getTotalContainers()).toBe(0)
      
      contractFunctions.createContainer('ECO-001', 'plastic', 50, 'manufacturer-1')
      expect(contractFunctions.getTotalContainers()).toBe(1)
      
      contractFunctions.createContainer('ECO-002', 'glass', 30, 'manufacturer-2')
      expect(contractFunctions.getTotalContainers()).toBe(2)
    })
  })
  
  describe('Edge Cases', () => {
    it('should handle containers with zero carbon footprint', () => {
      const result = contractFunctions.createContainer(
          'ECO-ZERO',
          'carbon-neutral',
          0,
          'green-manufacturer'
      )
      
      expect(result.success).toBe('ECO-ZERO')
      
      const container = contractFunctions.getContainer('ECO-ZERO')
      expect(container.carbonFootprint).toBe(0)
    })
    
    it('should handle containers with high carbon footprint', () => {
      const result = contractFunctions.createContainer(
          'ECO-HIGH',
          'heavy-material',
          1000,
          'manufacturer'
      )
      
      expect(result.success).toBe('ECO-HIGH')
      
      const container = contractFunctions.getContainer('ECO-HIGH')
      expect(container.carbonFootprint).toBe(1000)
    })
    
    it('should handle long container IDs', () => {
      const longId = 'ECO-VERY-LONG-CONTAINER-ID-WITH-MANY-CHARACTERS'
      const result = contractFunctions.createContainer(
          longId,
          'plastic',
          50,
          'manufacturer'
      )
      
      expect(result.success).toBe(longId)
    })
    
    it('should handle long material type names', () => {
      const result = contractFunctions.createContainer(
          'ECO-001',
          'biodegradable-plant-based-composite-material',
          50,
          'manufacturer'
      )
      
      expect(result.success).toBe('ECO-001')
      
      const container = contractFunctions.getContainer('ECO-001')
      expect(container.materialType).toBe('biodegradable-plant-based-composite-material')
    })
  })
})
