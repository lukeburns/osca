import { useState } from 'react'
import { useSession } from 'next-auth/client'
import Meta from '../components/Meta'
import { Box, Divider, Text, Stack, Center, Heading, OrderedList, ListItem } from '@chakra-ui/react'
import { CheckIcon } from '@chakra-ui/icons'
import { Container } from '../components/Container'
import { Main } from '../components/Main'
import { Footer } from '../components/Footer'
import LotteryForm from '../components/LotteryForm'
import Header from '../components/Header'
import { Loader } from '../components/Loader'

const currentLotteryId = 'spring2021'

const formatId = id => {
  return id ? `${id[0].toUpperCase()}${id.slice(1, -4)} ${id.slice(-4)}` : ''
}

const enterLottery = (values, actions, callback = x => x) => {
  hit(`/api/lottery/enter?id=${currentLotteryId}&entryMetadata=${encodeURIComponent(JSON.stringify(values))}`)
    .then((data) => {
      actions.setSubmitting(false);
      callback(data);
    }).catch(console.error)

  // todo:
  // - [ ] metadata (T#, grad year) + metadata validation
  // - [ ] error handling: missed deadline, unqualifed, etc (see endpoint for errors)
}

function CountDown({ now, future }) {
  const remaining = future - now
  return <span>{remaining / 1000} seconds</span>
}

class EntrySubmission extends React.Component {
  constructor({ lottery = {} }) {
    super()
    const { latency } = lottery
    this.state = { time: Date.now() + latency }
    this.latency = latency
  }

  componentDidMount() {
    this.interval = setInterval(function () {
      this.setState({ time: Date.now() + this.latency })
    }.bind(this), 200)
  }

  componentWillUnmount() {
    clearInterval(this.interval)
  }

  render() {
    const { lottery = {}, setEntry } = this.props
    const { active, start, end, now, latency, lotteryId } = lottery
    this.latency = latency
    return (
      <Box mb={8}>
        {
          this.state.time >= start && end >= this.state.time
            ? <Stack align="center" spacing={4}>
              <LotteryForm onSubmit={(data, actions) => enterLottery(data, actions, setEntry)} />
              <Stack w="100%" p={5} shadow="md" borderWidth="1px" borderRadius="md">
                <Text m={2} fontSize="lg">The {formatId(lotteryId)} lottery is open for submissions!</Text>
                <Text color="gray.500" fontWeight="thin" m={2}><CountDown now={this.state.time} future={end} /> remaining</Text>
              </Stack>
              <Stack w="100%" spacing={2} p={5} textAlign="left">
                <Text noOfLines={2} flexWrap="wrap">You may change your entry after submitting up until the close of the lottery. After that, submissions are final.</Text>
                <Text flexWrap="wrap">If for some reason you are unable to submit with this page, please use the Google Form version.</Text>
              </Stack>
            </Stack>
            : (
              this.state.time > end
                ? <Text m={2} fontSize="lg">The {formatId(lotteryId)} lottery is now over. We hope you'll enter next round!</Text>
                : <Text m={2} fontSize="lg">The lottery begins in <CountDown now={this.state.time} future={start} /></Text>
            )
        }
      </Box>
    )
  }
}

function Entry({ entry }) {
  const { email, lotteryId, entryId, userData = {}, entryMetadata = {}, timestamp } = entry
  return (
    <Stack w="100%" mt={20} p={2} spacing={4} align="center">
      <CheckIcon w={8} h={8} color="teal.500" />
      <Text fontSize="lg">Thanks for entering, <strong>{email}</strong>!</Text>
      <Text fontWeight="thin">Your entry ID for the <strong>{formatId(lotteryId)}</strong> lottery is <strong>{entryId}</strong>.</Text>
      <Divider />
      <Stack border="1px" borderRadius="md" borderColor="teal.500" p={4} mt={1} spacing={1}>
        <Text mb={2} fontSize="xl">Your current entry: </Text>
        <Text fontWeight="thin">First Name: {entryMetadata.firstName}</Text>
        <Text fontWeight="thin">Last Name: {entryMetadata.lastName}</Text>
        <Text fontWeight="thin">OCMR: {entryMetadata.OCMR}</Text>
        <Text fontWeight="thin">tNumber: {entryMetadata.tNumber}</Text>   
        <Text fontWeight="thin">Preferences: </Text>
        <OrderedList my={4}>
          {entryMetadata.preferences.map(pref => (
            <ListItem fontWeight="thin" key={pref}>{pref}</ListItem>
          ))}
        </OrderedList>        
        <Text>You may also change your entry by resubmitting below.</Text>
      </Stack>
      {/* <pre>{JSON.stringify({ entryMetadata, userData, timestamp }, null, 2)}</pre> */}
    </Stack>
  )
}

function Wall({ condition, children = [], caught = '' }) {
  if (condition) {
    return children
  } else {
    return caught
  }
}

// todo:
// 1. nextjs should have a prefetching mechanism, so that the
// fetch is performed when hovering over a link to this page
// and doesn't have to be re-fetched every render.
// 2. handle users who aren't qualified to enter the lottery
// probably using another endpoint that checks for qualification.
// 3. maybe switch to the firestore clientside library, so that
// we can work with db updates realtime.
const Lottery = (props) => {
  let [session, loading] = useSession()
  const [entry, setEntry] = useState()
  const [lottery, setLottery] = useState()

  if (session && session.user) {
    const { email } = session.user

    if (!entry || !lottery) {
      loading = true
      hit(`/api/lottery/entries?lotteryId=${currentLotteryId}&email=${email}`).then(data => {
        console.log(data)
        if (data.length == 1) {
          setEntry(data[0])
        } else {
          setEntry({}) // empty object if no entry in db
        }
      }).catch(err => console.log(err))

      let now = Date.now()
      hit(`/api/lottery/lotteries?lotteryId=${currentLotteryId}`).then(data => {
        if (data.length == 1) {
          const lottery = data[0]
          const latency = lottery.now - now // cynical latency
          now = Date.now() + latency
          setLottery({ ...lottery, latency, now })
        } else {
          setLottery({}) // empty object if no entry in db
        }
      }).catch(err => console.log(err))
    } else {
      loading = false
    }
  }

  return (
    <>
      <Meta title="OSCA 2021 Spring Lottery" />
      <Header />
      <Container>
        <Wall condition={!loading} caught={<Center minH="100vh"><Loader /></Center>}>
          <Wall condition={session && session.user}
            caught={
              <Center minH="100vh">
                <Heading fontWeight="thin" color="gray.500">Login to enter the lottery.</Heading>
              </Center>
            }>

            <Main>
              {!(entry && entry.email)
                ? <EntrySubmission lottery={lottery} setEntry={setEntry} />
                : <Stack spacing={8}><Entry entry={entry} /><EntrySubmission lottery={lottery} setEntry={setEntry} /></Stack>}
            </Main>
          </Wall>
        </Wall>
        <Footer />
      </Container>
    </>
  )
}

export default Lottery

async function hit(...args) {
  return fetch(...args).then(x => x.json())
}

// single shot latency
// async function latency () {
//   const now = Date.now()
//   const time = await fetch('/api/time')
//   return time - now
// }
