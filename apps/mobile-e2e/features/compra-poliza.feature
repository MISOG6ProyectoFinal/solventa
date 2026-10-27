Feature: Compra de póliza desde la aplicación móvil

  @user1 @mobile
  Scenario: E001 - Comprar una póliza con pago aprobado
    Given el cliente ha iniciado sesión
    And existen productos disponibles
    When realiza una cotización válida
    And realiza un pago aprobado
    Then se debe emitir una póliza
    And la póliza debe aparecer entre sus pólizas
