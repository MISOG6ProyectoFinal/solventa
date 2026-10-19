import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as vega from 'vega';
import { compile } from 'vega-lite';

import { fetchCoverage } from './fetch-coverage.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = resolve(__dirname, '..');
const inputPath = join(projectRoot, 'data', 'sprint.json');
const outputDir = join(projectRoot, 'output');

const BLUE = '#2563EB';
const PURPLE = '#7C3AED';
const DARK_GREEN = '#166534';
const GRAY = '#94A3B8';

async function readData() {
  const content = await readFile(inputPath, 'utf8');
  return JSON.parse(content);
}

async function renderSvg(spec, filename) {
  const vegaSpec = compile(spec).spec;

  const view = new vega.View(vega.parse(vegaSpec), {
    renderer: 'none'
  });

  const svg = await view.toSVG();

  await writeFile(join(outputDir, filename), svg, 'utf8');

  console.log(`✓ ${filename}`);
}

function buildBurndownData(sprint) {
  const { totalStoryPoints, totalDays, days } = sprint;

  const result = [];

  // Línea ideal
  for (let day = 0; day <= totalDays; day++) {
    const remaining =
      totalStoryPoints - (totalStoryPoints / totalDays) * day;

    result.push({
      day,
      remaining: Math.max(0, remaining),
      type: 'Ideal'
    });
  }

  // Línea real
  let remaining = totalStoryPoints;

  result.push({
    day: 0,
    remaining,
    type: 'Real'
  });

  const sortedDays = [...days].sort(
    (a, b) => a.day - b.day
  );

  for (const entry of sortedDays) {
    remaining -= entry.completedStoryPoints;

    result.push({
      day: entry.day,
      remaining: Math.max(0, remaining),
      type: 'Real'
    });
  }

  return result;
}

function buildVelocityData(velocity) {
  return velocity.flatMap(({ week, planned, actual }) => [
    {
      week: `Semana ${week}`,
      type: 'Planeado',
      points: planned
    },
    {
      week: `Semana ${week}`,
      type: 'Real',
      points: actual
    }
  ]);
}

function buildBusinessValueData(businessValue) {
  const {
    daysPerWeek,
    dailyValues
  } = businessValue;

  const sortedValues = [...dailyValues].sort(
    (a, b) => a.day - b.day
  );

  let accumulated = 0;

  const result = [
    {
      day: 0,
      weekPosition: 0,
      businessValue: 0
    }
  ];

  for (const entry of sortedValues) {
    accumulated += entry.valueDelivered;

    result.push({
      day: entry.day,
      weekPosition: entry.day / daysPerWeek,
      businessValue: accumulated
    });
  }

  return result;
}

function burndownSpec(sprint) {
  return {
    width: 900,
    height: 450,
    title: 'Sprint Burndown Chart',

    data: {
      values: buildBurndownData(sprint)
    },

    mark: {
      type: 'line',
      point: true,
      strokeWidth: 3
    },

    encoding: {
      x: {
        field: 'day',
        type: 'quantitative',
        title: 'Día del sprint',
        scale: {
          domainMin: 0
        },
        axis: {
          tickMinStep: 1
        }
      },

      y: {
        field: 'remaining',
        type: 'quantitative',
        title: 'Puntos de historia restantes',
        scale: {
          domainMin: 0
        }
      },

      color: {
        field: 'type',
        type: 'nominal',
        title: null,
        scale: {
          domain: ['Ideal', 'Real'],
          range: [GRAY, BLUE]
        }
      }
    }
  };
}

function velocitySpec(velocity) {
  const data = buildVelocityData(velocity);

  const weekOrder = velocity.map(
    ({ week }) => `Semana ${week}`
  );

  return {
    width: 900,
    height: 450,
    title: 'Velocidad del equipo',

    data: {
      values: data
    },

    layer: [
      {
        mark: {
          type: 'bar',
          cornerRadiusTopLeft: 4,
          cornerRadiusTopRight: 4
        },

        encoding: {
          x: {
            field: 'week',
            type: 'ordinal',
            title: 'Semana',
            sort: weekOrder
          },

          xOffset: {
            field: 'type'
          },

          y: {
            field: 'points',
            type: 'quantitative',
            title: 'Puntos de historia',
            scale: {
              domainMin: 0
            }
          },

          color: {
            field: 'type',
            type: 'nominal',
            title: null,
            scale: {
              domain: ['Planeado', 'Real'],
              range: [BLUE, PURPLE]
            }
          }
        }
      },

      {
        mark: {
          type: 'text',
          dy: -8,
          fontWeight: 'bold'
        },

        encoding: {
          x: {
            field: 'week',
            type: 'ordinal',
            sort: weekOrder
          },

          xOffset: {
            field: 'type'
          },

          y: {
            field: 'points',
            type: 'quantitative'
          },

          text: {
            field: 'points',
            type: 'quantitative'
          },

          detail: {
            field: 'type'
          }
        }
      }
    ],

    resolve: {
      scale: {
        color: 'shared'
      }
    }
  };
}

function businessValueSpec(businessValue) {
  const values = buildBusinessValueData(businessValue);

  const totalWeeks = Math.ceil(
    businessValue.totalDays / businessValue.daysPerWeek
  );

  const weekTicks = Array.from(
    { length: totalWeeks + 1 },
    (_, index) => index
  );

  return {
    width: 900,
    height: 450,
    title: 'Business Value entregado',

    data: {
      values
    },

    mark: {
      type: 'line',
      point: {
        filled: true,
        size: 55
      },
      strokeWidth: 3,
      color: DARK_GREEN
    },

    encoding: {
      x: {
        field: 'weekPosition',
        type: 'quantitative',
        title: 'Semana',

        scale: {
          domain: [0, totalWeeks],
          nice: false,
          zero: true
        },

        axis: {
          values: weekTicks,
          format: '.0f',
          grid: true
        }
      },

      y: {
        field: 'businessValue',
        type: 'quantitative',
        title: 'Business Value acumulado',

        scale: {
          domain: [0, 100],
          nice: false,
          zero: true
        },

        axis: {
          values: [0, 20, 40, 60, 80, 100]
        }
      },

      tooltip: [
        {
          field: 'day',
          type: 'quantitative',
          title: 'Día'
        },
        {
          field: 'weekPosition',
          type: 'quantitative',
          title: 'Semana',
          format: '.1f'
        },
        {
          field: 'businessValue',
          type: 'quantitative',
          title: 'Business Value acumulado'
        }
      ]
    }
  };
}

function buildReleaseBurndownData(releaseBurndown) {
  const sprints = [...releaseBurndown.sprints].sort(
    (a, b) => a.sprint - b.sprint
  );

  const totalStoryPoints = sprints.reduce(
    (sum, sprint) => sum + sprint.plannedStoryPoints,
    0
  );

  const result = [];

  let plannedRemaining = totalStoryPoints;

  result.push({
    sprint: 'Inicio',
    remaining: plannedRemaining,
    type: 'Planeado'
  });

  for (const sprint of sprints) {
    plannedRemaining -= sprint.plannedStoryPoints;

    result.push({
      sprint: `Sprint ${sprint.sprint}`,
      remaining: Math.max(0, plannedRemaining),
      type: 'Planeado'
    });
  }

  let actualRemaining = totalStoryPoints;

  result.push({
    sprint: 'Inicio',
    remaining: actualRemaining,
    type: 'Real'
  });

  for (const sprint of sprints) {
    if (!sprint.closed) {
      break;
    }

    actualRemaining -= sprint.completedStoryPoints;

    result.push({
      sprint: `Sprint ${sprint.sprint}`,
      remaining: Math.max(0, actualRemaining),
      type: 'Real'
    });
  }

  return result;
}

// Week 1 starts at local midnight on the project start date (UTC-5).
const PROJECT_START_MS = Date.parse('2026-10-05T05:00:00.000Z');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PLANNED_WEEKS = 8;

function projectWeek(isoDate) {
  const elapsed = Date.parse(isoDate) - PROJECT_START_MS;
  return Math.floor(elapsed / WEEK_MS) + 1;
}

function buildCoverageData(points) {
  const latestByWeek = new Map();

  for (const point of points) {
    const week = projectWeek(point.date);

    if (week < 1) {
      continue;
    }

    const key = `${point.app}:${week}`;
    const current = latestByWeek.get(key);

    if (!current || point.date > current.date) {
      latestByWeek.set(key, {
        week: `Semana ${week}`,
        weekNumber: week,
        app: point.app,
        coverage: point.coverage,
        date: point.date
      });
    }
  }

  return [...latestByWeek.values()];
}

function coverageWeekOrder(points) {
  const lastWeek = points.reduce(
    (max, point) => Math.max(max, point.weekNumber),
    PLANNED_WEEKS
  );

  return Array.from(
    { length: lastWeek },
    (_, index) => `Semana ${index + 1}`
  );
}

function coverageSpec(points) {
  const values = buildCoverageData(points);
  const weekOrder = coverageWeekOrder(values);

  return {
    width: 900,
    height: 450,
    title: 'Cobertura de código',

    data: {
      values
    },

    mark: {
      type: 'line',
      point: true,
      strokeWidth: 3
    },

    encoding: {
      x: {
        field: 'week',
        type: 'ordinal',
        title: 'Semana',
        sort: weekOrder,
        scale: {
          domain: weekOrder
        }
      },

      y: {
        field: 'coverage',
        type: 'quantitative',
        title: 'Cobertura (%)',
        scale: {
          domain: [0, 100]
        }
      },

      color: {
        field: 'app',
        type: 'nominal',
        title: null,
        scale: {
          domain: ['Backend', 'Mobile', 'Web'],
          range: [BLUE, PURPLE, DARK_GREEN]
        }
      },

      tooltip: [
        {
          field: 'week',
          type: 'ordinal',
          title: 'Semana'
        },
        {
          field: 'date',
          type: 'temporal',
          title: 'Medición',
          format: '%d %b %Y'
        },
        {
          field: 'app',
          type: 'nominal',
          title: 'Aplicación'
        },
        {
          field: 'coverage',
          type: 'quantitative',
          title: 'Cobertura (%)',
          format: '.1f'
        }
      ]
    }
  };
}

function releaseBurndownSpec(releaseBurndown) {
  const values = buildReleaseBurndownData(releaseBurndown);

  const sprintOrder = [
    'Inicio',
    ...[...releaseBurndown.sprints]
      .sort((a, b) => a.sprint - b.sprint)
      .map(({ sprint }) => `Sprint ${sprint}`)
  ];

  return {
    width: 900,
    height: 450,
    title: 'Release Burndown Chart',

    data: {
      values
    },

    mark: {
      type: 'line',
      point: true,
      strokeWidth: 3
    },

    encoding: {
      x: {
        field: 'sprint',
        type: 'ordinal',
        title: 'Sprint',
        sort: sprintOrder
      },

      y: {
        field: 'remaining',
        type: 'quantitative',
        title: 'Puntos de historia restantes',
        scale: {
          domainMin: 0
        }
      },

      color: {
        field: 'type',
        type: 'nominal',
        title: null,
        scale: {
          domain: ['Planeado', 'Real'],
          range: [GRAY, BLUE]
        }
      }
    }
  };
}

async function main() {
  const data = await readData();

  await mkdir(outputDir, {
    recursive: true
  });

  await renderSvg(
    burndownSpec(data.sprint),
    'burndown.svg'
  );

  await renderSvg(
    velocitySpec(data.velocity),
    'velocity.svg'
  );

  await renderSvg(
    businessValueSpec(data.businessValue),
    'business-value.svg'
  );

  await renderSvg(
    releaseBurndownSpec(data.releaseBurndown),
    'release-burndown.svg'
  );

  const coveragePoints = await fetchCoverage(projectRoot);

  if (coveragePoints.length === 0) {
    throw new Error('No coverage reports were found on main.');
  }

  await renderSvg(
    coverageSpec(coveragePoints),
    'coverage.svg'
  );

  console.log('\nGráficas generadas correctamente.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});