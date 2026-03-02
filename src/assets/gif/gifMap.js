const GIF_MAP = {
  // Bíceps
  "Curl Bíceps Barra":        new URL('./Bicep/Curl Bíceps Barra.gif',        import.meta.url).href,
  "Curl Concentrado":         new URL('./Bicep/Curl Concentrado.gif',         import.meta.url).href,
  "Curl Mancuernas":          new URL('./Bicep/Curl Mancuernas.gif',          import.meta.url).href,
  "Curl Martillo":            new URL('./Bicep/Curl Martillo.gif',            import.meta.url).href,
  "Curl Polea":               new URL('./Bicep/Curl Polea.gif',               import.meta.url).href,

  // Cardio
  "Bicicleta Estática":       new URL('./Cardio/Bicicleta Estática.gif',      import.meta.url).href,
  "Burpees":                  new URL('./Cardio/Burpees.gif',                 import.meta.url).href,
  "Cinta Correr":             new URL('./Cardio/Cinta Correr.gif',            import.meta.url).href,
  "Elíptica":                 new URL('./Cardio/Elíptica.gif',                import.meta.url).href,
  "Saltar Cuerda":            new URL('./Cardio/Saltar Cuerda.gif',           import.meta.url).href,

  // Core
  "Crunch Polea":             new URL('./Core/Crunch Polea.gif',              import.meta.url).href,
  "Crunch":                   new URL('./Core/Crunch.gif',                    import.meta.url).href,
  "Elevación de Piernas":     new URL('./Core/Elevación de Piernas.gif',      import.meta.url).href,
  "Elevación de Talones":     new URL('./Core/Elevación de Talones.gif',      import.meta.url).href,
  "Pantorrillas Máquina":     new URL('./Core/Pantorrillas maquinas.gif',     import.meta.url).href,
  "Plancha":                  new URL('./Core/Plancha.gif',                   import.meta.url).href,
  "Rueda Abdominal":          new URL('./Core/Rueda Abdominal.gif',           import.meta.url).href,

  // Cuádriceps
  "Extensión Cuádriceps":     new URL('./Cuadriceps/Extensión Cuádriceps.gif',import.meta.url).href,
  "Prensa de Pierna":         new URL('./Cuadriceps/Prensa de Pierna.gif',    import.meta.url).href,
  "Sentadilla Goblet":        new URL('./Cuadriceps/Sentadilla Goblet.gif',   import.meta.url).href,
  "Sentadilla":               new URL('./Cuadriceps/Sentadilla.gif',          import.meta.url).href,

  // Espalda
  "Dominadas":                new URL('./Espalda/Dominadas.gif',              import.meta.url).href,
  "Face Pull":                new URL('./Espalda/Face Pull.gif',              import.meta.url).href,
  "Jalón al Pecho":           new URL('./Espalda/Jalón al Pecho.gif',         import.meta.url).href,
  "Peso Muerto":              new URL('./Espalda/Peso Muerto.gif',            import.meta.url).href,
  "Pullover":                 new URL('./Espalda/Pullover.gif',               import.meta.url).href,
  "Remo con Barra":           new URL('./Espalda/Remo con Barra.gif',         import.meta.url).href,
  "Remo Mancuerna":           new URL('./Espalda/Remo Mancuerna.gif',         import.meta.url).href,
  "Remo Polea Baja":          new URL('./Espalda/Remo Polea Baja.gif',        import.meta.url).href,

  // Femoral
  "Curl Femoral Tumbado":     new URL('./Femoral/Curl Femoral Tumbado.gif',   import.meta.url).href,
  "Peso Muerto Rumano":       new URL('./Femoral/Peso Muerto Rumano.gif',     import.meta.url).href,

  // Glúteos
  "Abductores":               new URL('./Gluteos/Abductores.gif',             import.meta.url).href,
  "Hip Thrust":               new URL('./Gluteos/Hip Thrust.gif',             import.meta.url).href,

  // Hombros
  "Elevaciones Frontales":    new URL('./Hombro/Elevaciones Frontales.gif',   import.meta.url).href,
  "Elevaciones Laterales":    new URL('./Hombro/Elevaciones Laterales.gif',   import.meta.url).href,
  "Pájaros":                  new URL('./Hombro/Pájaros.gif',                 import.meta.url).href,
  "Press Arnold":             new URL('./Hombro/Press Arnold.gif',            import.meta.url).href,
  "Press Hombro Barra":       new URL('./Hombro/Press Hombro Barra.gif',      import.meta.url).href,
  "Press Hombro Máquina":     new URL('./Hombro/Press Hombro Máquina.gif',    import.meta.url).href,

  // Pecho
  "Aperturas Mancuernas":     new URL('./Pecho/aperturas_mancuernas.gif',     import.meta.url).href,
  "Crossover Polea":          new URL('./Pecho/Crossover Polea.gif',          import.meta.url).href,
  "Fondos":                   new URL('./Pecho/fondos.gif',                   import.meta.url).href,
  "Press Mancuernas":         new URL('./Pecho/Press Mancuernas.gif',         import.meta.url).href,
  "Press Pecho Máquina":      new URL('./Pecho/Press Pecho Máquina.gif',      import.meta.url).href,
  "Press Banca Inclinado":    new URL('./Pecho/press_banca_inclinado.gif',    import.meta.url).href,
  "Press Banca":              new URL('./Pecho/press_banca.gif',              import.meta.url).href,

  // Tríceps
  "Extensión Tríceps Mancuerna": new URL('./Triceps/Extensión Tríceps Mancuerna.gif', import.meta.url).href,
  "Fondos Tríceps":           new URL('./Triceps/Fondos Tríceps.gif',         import.meta.url).href,
  "Press Francés":            new URL('./Triceps/Press Francés.gif',          import.meta.url).href,
  "Tríceps Polea":            new URL('./Triceps/Tríceps Polea.gif',          import.meta.url).href,

  // Sin gif por ahora
  "Zancadas":                 null,
};

export default GIF_MAP;