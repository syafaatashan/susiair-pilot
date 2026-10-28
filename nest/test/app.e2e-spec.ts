import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import request from 'supertest'
import type { App } from 'supertest/types.js'
import { AppModule } from '../src/app.module.js'
import { GlobalExceptionFilter } from '../src/common/exception.filter.js'

/**
 * End-to-end tests over the real HTTP surface, with the same global pipe and
 * filter that main.ts installs.
 */
describe('Susi Air Pilot API (e2e)', () => {
  let app: INestApplication<App>
  let token: string

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
    app.useGlobalFilters(new GlobalExceptionFilter())
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  const auth = () => ({ Authorization: `Bearer ${token}` })

  it('POST /auth/login returns a bearer token for the hardcoded pilot', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'johndoe', password: 'susiairtest' })
      .expect(200)

    expect(res.body.token_type).toBe('Bearer')
    expect(typeof res.body.access_token).toBe('string')
    token = res.body.access_token
  })

  it('POST /auth/login rejects wrong credentials with a consistent error shape', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'johndoe', password: 'wrong' })
      .expect(401)

    expect(Object.keys(res.body).sort()).toEqual(['error', 'message', 'path', 'statusCode', 'timestamp'])
    expect(res.body.message).toBe('Invalid credentials')
  })

  it('POST /auth/login rejects a malformed JSON body with a sanitized message', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username": ')
      .expect(400)

    expect(res.body.message).toBe('Invalid JSON payload')
  })

  const protectedRoutes: Array<[string, string]> = [
    ['get', '/pilot/me'],
    ['get', '/flight-hours?from=2026-05-01&to=2026-05-05'],
    ['get', '/flight-hours/summary?range=1w'],
    ['get', '/documents'],
    ['get', '/schedules?year=2026&month=5'],
  ]

  it.each(protectedRoutes)('GET %s is guarded (401 without a token)', async (_m, url) => {
    const res = await request(app.getHttpServer()).get(url).expect(401)
    expect(res.body.statusCode).toBe(401)
    expect(res.body.error).toBe('Unauthorized')
  })

  it.each(protectedRoutes)('GET %s works with a valid token', async (_m, url) => {
    await request(app.getHttpServer()).get(url).set(auth()).expect(200)
  })

  it('GET /pilot/me returns name, total hours and avatar', async () => {
    const res = await request(app.getHttpServer()).get('/pilot/me').set(auth()).expect(200)
    expect(res.body.name).toBe('John Doe')
    expect(res.body.totalFlightHours).toBe(1444.5)
    expect(res.body.avatarUrl).toMatch(/^https?:\/\//)
  })

  it('GET /flight-hours/summary returns 15 points with today centred and the brief bounds', async () => {
    const res = await request(app.getHttpServer()).get('/flight-hours/summary?range=1w').set(auth()).expect(200)
    expect(res.body.chartData).toHaveLength(15)
    expect(res.body.chartData[7].date).toBe(res.body.today)
    expect(res.body.limit).toBe(40)
    expect(res.body.yMax).toBe(45)
  })

  it('GET /flight-hours validates its parameters', async () => {
    await request(app.getHttpServer()).get('/flight-hours?from=nope&to=2026-05-05').set(auth()).expect(400)
    await request(app.getHttpServer()).get('/flight-hours?from=2026-02-30&to=2026-05-05').set(auth()).expect(400)
    await request(app.getHttpServer()).get('/flight-hours?from=2026-05-10&to=2026-05-01').set(auth()).expect(400)
    await request(app.getHttpServer()).get('/flight-hours?from=1900-01-01&to=2100-01-01').set(auth()).expect(400)
    await request(app.getHttpServer()).get('/flight-hours').set(auth()).expect(400)
  })

  it('GET /flight-hours/summary rejects an unknown range', async () => {
    await request(app.getHttpServer()).get('/flight-hours/summary?range=2w').set(auth()).expect(400)
  })

  it('GET /schedules validates year and month', async () => {
    await request(app.getHttpServer()).get('/schedules?year=2026&month=13').set(auth()).expect(400)
    await request(app.getHttpServer()).get('/schedules?year=2026').set(auth()).expect(400)
  })

  it('GET /schedules returns only the requested month plus the legend', async () => {
    const res = await request(app.getHttpServer()).get('/schedules?year=2026&month=5').set(auth()).expect(200)
    expect(res.body.schedules).toHaveLength(21)
    expect(res.body.legend).toHaveLength(10)
    expect(res.body.schedules.every((s: { duty_date: string }) => s.duty_date.startsWith('2026-05'))).toBe(true)
  })

  it('GET /documents returns an urgency status computed server-side', async () => {
    const res = await request(app.getHttpServer()).get('/documents').set(auth()).expect(200)
    expect(res.body).toHaveLength(5)
    for (const doc of res.body) {
      const expected = doc.daysRemaining <= 0 ? 'expired' : doc.daysRemaining <= 30 ? 'soon' : 'safe'
      expect(`${doc.id}=${doc.status}`).toBe(`${doc.id}=${expected}`)
    }
  })

  it('unknown routes return the same error shape', async () => {
    const res = await request(app.getHttpServer()).get('/does-not-exist').expect(404)
    expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found', path: '/does-not-exist' })
  })
})
