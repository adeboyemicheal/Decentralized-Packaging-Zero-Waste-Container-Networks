;; Container Lifecycle Contract
;; Manages zero-waste container usage

(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u200))
(define-constant ERR_NOT_FOUND (err u201))
(define-constant ERR_INVALID_STATE (err u202))
(define-constant ERR_ALREADY_EXISTS (err u203))

;; Container states
(define-constant STATE_MANUFACTURED u0)
(define-constant STATE_DISTRIBUTED u1)
(define-constant STATE_IN_USE u2)
(define-constant STATE_COLLECTED u3)
(define-constant STATE_RECYCLED u4)
(define-constant STATE_DISPOSED u5)

;; Data structures
(define-map containers
  { container-id: (string-ascii 50) }
  {
    manufacturer: principal,
    material-type: (string-ascii 50),
    current-state: uint,
    created-at: uint,
    current-owner: (optional principal),
    recycling-count: uint,
    carbon-footprint: uint
  }
)

(define-map container-history
  { container-id: (string-ascii 50), event-id: uint }
  {
    previous-state: uint,
    new-state: uint,
    actor: principal,
    timestamp: uint,
    location: (string-ascii 100)
  }
)

(define-data-var total-containers uint u0)
(define-data-var next-event-id uint u0)

;; Public functions
(define-public (create-container
  (container-id (string-ascii 50))
  (material-type (string-ascii 50))
  (carbon-footprint uint)
)
  (let ((manufacturer tx-sender))
    (asserts! (is-none (map-get? containers { container-id: container-id })) ERR_ALREADY_EXISTS)
    (map-set containers
      { container-id: container-id }
      {
        manufacturer: manufacturer,
        material-type: material-type,
        current-state: STATE_MANUFACTURED,
        created-at: block-height,
        current-owner: none,
        recycling-count: u0,
        carbon-footprint: carbon-footprint
      }
    )
    (unwrap-panic (add-container-event container-id STATE_MANUFACTURED STATE_MANUFACTURED "Factory"))
    (var-set total-containers (+ (var-get total-containers) u1))
    (ok container-id)
  )
)

(define-public (update-container-state
  (container-id (string-ascii 50))
  (new-state uint)
  (location (string-ascii 100))
)
  (let (
    (container (unwrap! (map-get? containers { container-id: container-id }) ERR_NOT_FOUND))
    (current-state (get current-state container))
  )
    (asserts! (is-valid-state-transition current-state new-state) ERR_INVALID_STATE)
    (map-set containers
      { container-id: container-id }
      (merge container { current-state: new-state })
    )
    (unwrap-panic (add-container-event container-id current-state new-state location))
    (ok true)
  )
)

(define-public (transfer-container (container-id (string-ascii 50)) (new-owner principal))
  (let ((container (unwrap! (map-get? containers { container-id: container-id }) ERR_NOT_FOUND)))
    (map-set containers
      { container-id: container-id }
      (merge container { current-owner: (some new-owner) })
    )
    (ok true)
  )
)

(define-public (recycle-container (container-id (string-ascii 50)))
  (let (
    (container (unwrap! (map-get? containers { container-id: container-id }) ERR_NOT_FOUND))
    (recycling-count (get recycling-count container))
  )
    (asserts! (is-eq (get current-state container) STATE_COLLECTED) ERR_INVALID_STATE)
    (map-set containers
      { container-id: container-id }
      (merge container {
        current-state: STATE_RECYCLED,
        recycling-count: (+ recycling-count u1)
      })
    )
    (unwrap-panic (add-container-event container-id STATE_COLLECTED STATE_RECYCLED "Recycling Facility"))
    (ok true)
  )
)

;; Private functions
(define-private (add-container-event
  (container-id (string-ascii 50))
  (previous-state uint)
  (new-state uint)
  (location (string-ascii 100))
)
  (let ((event-id (var-get next-event-id)))
    (map-set container-history
      { container-id: container-id, event-id: event-id }
      {
        previous-state: previous-state,
        new-state: new-state,
        actor: tx-sender,
        timestamp: block-height,
        location: location
      }
    )
    (var-set next-event-id (+ event-id u1))
    (ok event-id)
  )
)

(define-private (is-valid-state-transition (current-state uint) (new-state uint))
  (or
    (and (is-eq current-state STATE_MANUFACTURED) (is-eq new-state STATE_DISTRIBUTED))
    (and (is-eq current-state STATE_DISTRIBUTED) (is-eq new-state STATE_IN_USE))
    (and (is-eq current-state STATE_IN_USE) (is-eq new-state STATE_COLLECTED))
    (and (is-eq current-state STATE_COLLECTED) (is-eq new-state STATE_RECYCLED))
    (and (is-eq current-state STATE_COLLECTED) (is-eq new-state STATE_DISPOSED))
    (and (is-eq current-state STATE_RECYCLED) (is-eq new-state STATE_DISTRIBUTED))
  )
)

;; Read-only functions
(define-read-only (get-container (container-id (string-ascii 50)))
  (map-get? containers { container-id: container-id })
)

(define-read-only (get-container-event (container-id (string-ascii 50)) (event-id uint))
  (map-get? container-history { container-id: container-id, event-id: event-id })
)

(define-read-only (get-total-containers)
  (var-get total-containers)
)
