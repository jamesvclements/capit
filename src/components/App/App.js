import React, { Component } from 'react';
import {
  Navbar,
  NavbarBrand,
  Container,
  Row,
  Col,
  ListGroup,
  ListGroupItem,
  Badge,
  InputGroup,
  Input,
  InputGroupButton,
  Button,
  Card,
  CardBlock
} from 'reactstrap';
import Dropzone from 'react-dropzone'
import request from 'superagent'
import Clarifai from 'clarifai'
import cheerio from 'cheerio'
import './App.css'

import imageIcon from '../../static/image-icon.png'
import prevIcon from '../../static/prev-icon.png'
import nextIcon from '../../static/next-icon.png'
import trashIcon from '../../static/trash-icon.png'

const CLOUDINARY_UPLOAD_PRESET = 'gkij9g6j'
const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/cumulus/upload'

const LYRICS_URL = 'http://www.lyrics.com/lyrics'

const clarifai = new Clarifai.App(
  'hvtIbdW5VKLiyION5K9cG6MJZUG_cGWTL_7EPAJm',
  'lIzWcE3sEs_lZVzlGWYPez2labJ6rKrteZy2k1pf'
)

class App extends Component {
  constructor() {
    super()
    this.state = {
      image: null,
      imageURL: '',
      concepts: [],
      tags: [],
      customTag: '',
      captions: [],
      currentCaptionIndex: 0
    }
  }

  render() {
    return (
      <div>
        <Navbar color="inverse" inverse>
          <NavbarBrand href="/">CAPIT</NavbarBrand>
        </Navbar>
        <Container>
          <Row>
            <Col>
              <Dropzone
                id='dropzone'
                onDrop={this.onDrop.bind(this)}
                multiple={false}
                accept='image/*'>
                {this.state.imageURL === '' ?
                  <img src={imageIcon} alt='add a pic' className='img-icon'></img>
                  :
                  <img id='mainImage' alt='something broke' className='main-image' src={this.state.imageURL}></img>
                }
              </Dropzone>
            </Col>
          </Row>
          {
            this.state.captions.length === 0
              ? null
              :
              <Row>
                <Col>
                  <Container>
                    <Row>
                      <Col>
                        <div id='captions'>
                          <img
                            src={prevIcon}
                            alt='prev'
                            className='pagination-icon'
                            onClick={this.prev.bind(this)}>
                          </img>
                          <Card className='captionCard'>
                            <CardBlock>
                              <div id='lyrics'>{`"${this.state.captions[this.state.currentCaptionIndex].lyrics}"`}</div>
                              <div id='meta'>{`-${this.state.captions[this.state.currentCaptionIndex].artist} (${this.state.captions[this.state.currentCaptionIndex].album} • ${this.state.captions[this.state.currentCaptionIndex].title})`}</div> 
                            </CardBlock>
                          </Card>
                          <img
                            src={nextIcon}
                            alt='next'
                            className='pagination-icon'
                            onClick={this.next.bind(this)}>
                          </img>
                        </div>
                      </Col>
                    </Row>
                  </Container>
                </Col>
              </Row>
          }
          {
            this.state.concepts.length === 0
              ? null
              :
              <Row>
                <Col>
                  <ListGroup className='tags'>
                    {
                      this.state.tags
                        .map((tag, i) => {
                          return (
                            <ListGroupItem key={i} className='justify-content-between'>
                              {tag.name}
                              <span>
                                {tag.value ? <Badge pill>{tag.value.toFixed(2)}</Badge> : null}
                                <img
                                  src={trashIcon}
                                  alt='delete'
                                  className='trash-icon'
                                  onClick={() => {
                                    let tags = this.state.tags.slice()
                                    tags.splice(i, 1)
                                    this.setState({
                                      tags: tags
                                    })
                                  }}>
                                </img>
                              </span>
                            </ListGroupItem>
                          )
                        })
                    }
                    <ListGroupItem className='justify-content-between'>
                      <InputGroup>
                        <Input className='custom-tag' placeholder={`${this.state.concepts[6].name}, ${this.state.concepts[7].name}, ${this.state.concepts[8].name}...`} value={this.state.customTag} onChange={this.updateCustomTag.bind(this)}></Input>
                        <InputGroupButton><Button onClick={this.addTag.bind(this)}>ADD TAG</Button></InputGroupButton>
                      </InputGroup>
                    </ListGroupItem>
                  </ListGroup>
                  <Button block color='primary' onClick={this.getCaptions.bind(this)}>GET CAPTIONS</Button>
                </Col>
              </Row>
          }
        </Container>
      </div>
    );
  }

  onDrop(files) {
    if (files.length === 1) {
      this.setState({
        image: files[0]
      })

      this.uploadImage(files[0])
        .then(() => {
          let frame = this
          clarifai.models.predict(Clarifai.GENERAL_MODEL, this.state.imageURL).then(
            function (response) {
              frame.setState({
                concepts: response.outputs[0].data.concepts,
                tags: response.outputs[0].data.concepts.slice(0, 4),
              })
            },
            function (err) {
              console.error(err);
            }
          )
        })

    } else {
      console.error('invalid file')
    }
  }

  uploadImage(image) {
    return new Promise((resolve, reject) => {
      let upload = request.post(CLOUDINARY_UPLOAD_URL)
        .field('upload_preset', CLOUDINARY_UPLOAD_PRESET)
        .field('file', image);

      upload.end((err, response) => {
        if (err) {
          console.error(err)
          reject(err)
        }

        if (response.body.secure_url !== '') {
          this.setState({
            imageURL: response.body.secure_url
          })
          resolve()
        }
      })
    })
  }

  updateCustomTag(event) {
    this.setState({
      customTag: event.target.value
    })
  }

  addTag() {
    this.setState({
      tags: this.state.tags.concat([{
        name: this.state.customTag
      }]),
      customTag: ''
    })
  }

  scrapeLyrics() {
    return new Promise((resolve, reject) => {
      let captions = []
      for (let i = 0; i < this.state.tags.length; i++) {
        request
          .get(`${LYRICS_URL}/${this.state.tags[i].name}`)
          .end((err, response) => {
            if (err) {
              console.error(err)
              reject(err)
            }

            let $ = cheerio.load(response.text)
            let length = $('.sec-lyric').length

            $('.sec-lyric').each((idx, elem) => {
              let meta = $(elem).children('.lyric-meta')
              let caption = {
                artist: $(meta).children('.lyric-meta-artists').children('a').text(),
                album: $(meta).children('.lyric-meta-album').children('a').text(),
                title: $(meta).children('.lyric-meta-title').children('a').text(),
                lyrics: $(elem).children('.lyric-body').text(),
                tag: this.state.tags[i].name
              }
              captions.push(caption)
              if (i === this.state.tags.length - 1 && idx === length - 1) {
                resolve(captions)
              }
            })
          })
      }
    })
  }

  getCaptions() {
    this.setState({
      captions: []
    })
    this.scrapeLyrics()
      .then(captions => {
        this.setState({
          captions: captions
        })
      })
      .catch(err => {
        console.error(err)
      })
  }

  prev() {
    this.setState({
      currentCaptionIndex: this.state.currentCaptionIndex === 0 ? this.state.captions.length - 1 : this.state.currentCaptionIndex - 1
    })
  }

  next() {
    this.setState({
      currentCaptionIndex: this.state.currentCaptionIndex < this.state.captions.length ? this.state.currentCaptionIndex + 1 : 0
    })
  }

}

export default App;